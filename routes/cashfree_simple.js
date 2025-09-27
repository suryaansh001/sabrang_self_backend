const express = require('express');
const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { User, Purchase, TeamComposition } = require('../models/models');
const { sendRegistrationEmail } = require('../utils/emailService');
const { generateUserQRCode } = require('../utils/qrCodeService');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Initialize Cashfree with production credentials
let cashfree;
let isUsingProd = true;

function initializeCashfree(useProd = true) {
    if (useProd) {
        console.log('🔄 Using PRODUCTION credentials...');
        cashfree = new Cashfree(
            CFEnvironment.PRODUCTION,
            process.env.CASHFREE_PROD_CLIENT_ID,
            process.env.CASHFREE_PROD_CLIENT_SECRET
        );
        isUsingProd = true;
        console.log('✅ Cashfree initialized with PRODUCTION environment');
    } else {
        console.log('🧪 Fallback to TEST credentials...');
        cashfree = new Cashfree(
            CFEnvironment.SANDBOX,
            process.env.CASHFREE_CLIENT_ID,
            process.env.CASHFREE_CLIENT_SECRET
        );
        isUsingProd = false;
        console.log('✅ Cashfree initialized with SANDBOX environment');
    }
}

// Start with PRODUCTION credentials
initializeCashfree(true);

console.log('Cashfree SDK initialized:', {
    testClientId: process.env.CASHFREE_CLIENT_ID ? 'Set' : 'Not set',
    testClientSecret: process.env.CASHFREE_CLIENT_SECRET ? 'Set' : 'Not set',
    prodClientId: process.env.CASHFREE_PROD_CLIENT_ID ? 'Set' : 'Not set',
    prodClientSecret: process.env.CASHFREE_PROD_CLIENT_SECRET ? 'Set' : 'Not set',
    currentEnvironment: 'PRODUCTION (with SANDBOX fallback)'
});

// Generate unique order ID using crypto
function generateOrderId() {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256');
    hash.update(uniqueId);
    const orderId = hash.digest('hex');
    return orderId.substr(0, 12);
}

// Test route
// Test email endpoint
router.post('/test-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        console.log('📧 Testing email to:', email);
        console.log('📧 Environment variables:', {
            CLIENT_ID: process.env.CLIENT_ID ? 'SET' : 'MISSING',
            CLIENT_SECRET: process.env.CLIENT_SECRET ? 'SET' : 'MISSING',
            TENANT_ID: process.env.TENANT_ID ? 'SET' : 'MISSING',
            FROM_EMAIL: process.env.FROM_EMAIL || 'MISSING'
        });

        const emailService = require('../utils/emailService');
        const result = await emailService.sendPaymentInitiatedEmail({
            email: email,
            name: 'Test User',
            orderId: 'test_order_123',
            amount: 1,
            paymentSessionId: 'test_session_123',
            environment: 'production',
            qrCodeBase64: null,
            purchaseId: 'test_purchase_123'
        });

        res.json({ 
            success: true, 
            message: 'Email test completed',
            result: result
        });
    } catch (error) {
        console.error('❌ Email test failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

// Get QR code by order ID
router.get('/qr-by-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('Fetching QR code for order:', orderId);

        const purchase = await Purchase.findOne({ orderId: orderId });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Security check: Only serve QR codes for completed payments
        if (purchase.paymentStatus !== 'completed') {
            console.log(`❌ Access denied: Payment not completed for order ${orderId}`);
            return res.status(403).json({
                success: false,
                message: 'Access denied: Payment not completed'
            });
        }

        if (!purchase.qrCodeBase64) {
            return res.status(404).json({
                success: false,
                message: 'QR code not found for this order'
            });
        }

        // Return QR code as base64 or as image
        const format = req.query.format || 'json';
        
        if (format === 'image') {
            const qrBuffer = Buffer.from(purchase.qrCodeBase64, 'base64');
            res.set({
                'Content-Type': 'image/png',
                'Content-Length': qrBuffer.length
            });
            res.send(qrBuffer);
        } else {
            res.json({
                success: true,
                data: {
                    purchaseId: purchase._id,
                    orderId: purchase.orderId,
                    qrCodeBase64: purchase.qrCodeBase64,
                    userDetails: {
                        name: purchase.userDetails?.name,
                        email: purchase.userDetails?.email,
                        referralCode: purchase.userDetails?.referralCode
                    },
                    qrGenerated: purchase.qrGenerated,
                    paymentStatus: purchase.paymentStatus
                }
            });
        }

    } catch (error) {
        console.error('❌ Error fetching QR code:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch QR code',
            error: error.message
        });
    }
});

// Get QR code from database
router.get('/qr/:purchaseId', async (req, res) => {
    try {
        const { purchaseId } = req.params;
        console.log('Fetching QR code for purchase:', purchaseId);

        const purchase = await Purchase.findById(purchaseId);
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        // Security check: Only serve QR codes for completed payments
        if (purchase.paymentStatus !== 'completed') {
            console.log(`❌ Access denied: Payment not completed for purchase ${purchaseId}`);
            return res.status(403).json({
                success: false,
                message: 'Access denied: Payment not completed'
            });
        }

        if (!purchase.qrCodeBase64) {
            return res.status(404).json({
                success: false,
                message: 'QR code not found for this purchase'
            });
        }

        // Return QR code as base64 or as image
        const format = req.query.format || 'json';
        
        if (format === 'image') {
            const qrBuffer = Buffer.from(purchase.qrCodeBase64, 'base64');
            res.set({
                'Content-Type': 'image/png',
                'Content-Length': qrBuffer.length
            });
            res.send(qrBuffer);
        } else {
            res.json({
                success: true,
                data: {
                    purchaseId: purchase._id,
                    orderId: purchase.orderId,
                    qrCodeBase64: purchase.qrCodeBase64,
                    userDetails: {
                        name: purchase.userDetails?.name,
                        email: purchase.userDetails?.email
                    },
                    qrGenerated: purchase.qrGenerated,
                    paymentStatus: purchase.paymentStatus
                }
            });
        }

    } catch (error) {
        console.error('❌ Error fetching QR code:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch QR code',
            error: error.message
        });
    }
});

router.get('/', (req, res) => {
    res.json({ 
        message: 'Cashfree payment routes working',
        environment: process.env.NODE_ENV,
        emailConfig: {
            CLIENT_ID: process.env.CLIENT_ID ? 'SET' : 'MISSING',
            CLIENT_SECRET: process.env.CLIENT_SECRET ? 'SET' : 'MISSING',
            TENANT_ID: process.env.TENANT_ID ? 'SET' : 'MISSING', 
            FROM_EMAIL: process.env.FROM_EMAIL || 'MISSING'
        }
    });
});

// Create payment order - Following latest Cashfree docs with fallback
router.post('/create-order', async (req, res) => {
    try {
        console.log('Create order request:', req.body);
        
        const { 
            amount,
            customerName, 
            customerEmail, 
            customerPhone,
            referralCode
        } = req.body;

        // Validate required fields
        if (!amount || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, customerEmail'
            });
        }

        // Generate unique order ID using crypto (following latest docs format)
        const orderId = `order_${generateOrderId()}`;

        // Create order request following latest Cashfree documentation
        const orderRequest = {
            order_amount: parseFloat(amount),
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: `customer_${Date.now()}`,
                customer_name: customerName || "Customer",
                customer_email: customerEmail,
                customer_phone: customerPhone || "9999999999"
            },
            order_meta: {
                return_url: `https://sabrang.jklu.edu.in/payment/success?order_id=${orderId}`
            }
        };

        console.log('Cashfree order request:', orderRequest);
        console.log('Current environment:', isUsingProd ? 'PRODUCTION' : 'SANDBOX');

        let response;
        let attemptedFallback = false;

        try {
            // Add timeout for Cashfree API call to prevent hanging
            const createOrderWithTimeout = async (orderReq) => {
                return Promise.race([
                    cashfree.PGCreateOrder(orderReq),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Cashfree API timeout')), 10000)
                    )
                ]);
            };
            
            // First attempt with current credentials
            response = await createOrderWithTimeout(orderRequest);
            console.log('✅ Cashfree response (first attempt):', response.data);
        } catch (firstError) {
            console.log('❌ First attempt failed:', firstError.response?.data || firstError.message);
            
            // Handle timeout and network errors specifically
            if (firstError.message?.includes('timeout') || 
                firstError.message?.includes('ECONNRESET') ||
                firstError.message?.includes('ETIMEDOUT')) {
                console.log('⏰ Detected timeout/network error, attempting retry...');
            }
            
            // If not already using prod and we have prod credentials, try fallback
            if (!isUsingProd && process.env.CASHFREE_PROD_CLIENT_ID && process.env.CASHFREE_PROD_CLIENT_SECRET) {
                console.log('🔄 Attempting fallback to PRODUCTION credentials...');
                initializeCashfree(true);
                attemptedFallback = true;
                
                try {
                    const createOrderWithTimeoutFallback = async (orderReq) => {
                        return Promise.race([
                            cashfree.PGCreateOrder(orderReq),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Cashfree API timeout (fallback)')), 10000)
                            )
                        ]);
                    };
                    
                    response = await createOrderWithTimeoutFallback(orderRequest);
                    console.log('✅ Cashfree response (fallback successful):', response.data);
                } catch (fallbackError) {
                    console.log('❌ Fallback also failed:', fallbackError.response?.data || fallbackError.message);
                    throw fallbackError;
                }
            } else {
                throw firstError;
            }
        }

        // Save order to database
        try {
            console.log('🔍 Creating purchase record for orderId:', response.data.order_id);
            const newPurchase = new Purchase({
                orderId: response.data.order_id,
                paymentSessionId: response.data.payment_session_id,
                userDetails: {
                    name: customerName,
                    email: customerEmail,
                    contactNo: customerPhone,
                    referralCode: referralCode || '', // Store referral code
                    formData: req.body // Store complete request data
                },
                items: [{
                    type: 'event',
                    itemName: 'Demo Payment', // You can customize this based on the request
                    quantity: 1,
                    price: parseFloat(amount)
                }],
                subtotal: parseFloat(amount), // Add required subtotal field
                totalAmount: parseFloat(amount),
                currency: "INR",
                paymentStatus: 'pending',
                environment: isUsingProd ? 'production' : 'sandbox',
                fallbackUsed: attemptedFallback,
                metadata: {
                    userAgent: req.get('User-Agent'),
                    ip: req.ip || req.connection.remoteAddress,
                    timestamp: new Date()
                }
            });

            try {
                console.log('🔍 Attempting to save purchase with orderId:', newPurchase.orderId);
                await newPurchase.save();
                console.log('✅ Order saved to database:', response.data.order_id);
            } catch (error) {
                console.error('❌ Error saving purchase:', error);
                console.error('Purchase orderId:', newPurchase.orderId);
                console.error('Error details:', error.message);
                if (error.code === 11000) {
                    console.error('❌ Duplicate orderId error - orderId already exists:', newPurchase.orderId);
                }
                throw error;
            }

            // QR code generation will happen ONLY after successful payment confirmation
            // in the /success/:orderId endpoint
            console.log('ℹ️ QR code generation deferred until payment completion');

            // Send confirmation email with QR code
            // Note: Email will be sent after payment completion via /success/:orderId endpoint

        } catch (dbError) {
            console.error('❌ Failed to save order to database:', dbError.message);
            // Don't fail the order creation if database save fails
        }

        // Return successful response
        res.json({
            success: true,
            data: {
                order_id: response.data.order_id,
                payment_session_id: response.data.payment_session_id,
                order_status: response.data.order_status,
                amount: amount,
                currency: "INR",
                environment: isUsingProd ? 'production' : 'sandbox',
                fallback_used: attemptedFallback
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        
        // Determine user-friendly error message
        let userMessage = 'Payment order creation failed';
        let statusCode = 500;
        
        if (error.message?.includes('timeout')) {
            userMessage = 'Payment gateway is taking too long to respond. Please try again in a moment.';
            statusCode = 408; // Request Timeout
        } else if (error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
            userMessage = 'Connection to payment gateway failed. Please check your internet and try again.';
            statusCode = 503; // Service Unavailable
        } else if (error.response && error.response.data) {
            console.error('Cashfree error details:', error.response.data);
            userMessage = error.response.data.message || 'Payment gateway error occurred';
            statusCode = 400;
        }
        
        if (error.response && error.response.data) {
            console.error('Cashfree error details:', error.response.data);
            return res.status(statusCode).json({
                success: false,
                message: userMessage,
                error: error.response.data,
                environment: isUsingProd ? 'production' : 'sandbox',
                retry: statusCode >= 500 || error.message?.includes('timeout'), // Suggest retry for server errors and timeouts
                timestamp: new Date().toISOString()
            });
        }

        res.status(statusCode).json({
            success: false,
            message: userMessage,
            error: error.message,
            environment: isUsingProd ? 'production' : 'sandbox',
            retry: statusCode >= 500 || error.message?.includes('timeout'), // Suggest retry for server errors and timeouts
            timestamp: new Date().toISOString()
        });
    }
});

// Generate QR code for user using MongoDB ObjectID
async function generateQRCode(purchaseId, userData) {
    try {
        const qrDir = path.join(__dirname, '../app/qrcode');
        if (!fs.existsSync(qrDir)) {
            fs.mkdirSync(qrDir, { recursive: true });
        }

        const qrData = JSON.stringify({
            id: purchaseId,
            name: userData.name,
            email: userData.email,
            orderId: userData.orderId,
            timestamp: Date.now()
        });

        const qrFilename = `${purchaseId}.png`;
        const qrPath = path.join(qrDir, qrFilename);
        const qrRelativePath = `/app/qrcode/${qrFilename}`;

        return new Promise((resolve, reject) => {
            const qrPng = qr.image(qrData, { type: 'png', size: 10 });
            const writeStream = fs.createWriteStream(qrPath);
            const chunks = [];
            
            // Collect data for base64 conversion
            qrPng.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            qrPng.on('end', () => {
                const qrBuffer = Buffer.concat(chunks);
                const qrBase64 = qrBuffer.toString('base64');
                console.log(`✅ QR code generated: ${qrRelativePath}`);
                resolve({ 
                    qrPath: qrRelativePath, 
                    qrFilePath: qrPath,
                    qrBase64: qrBase64 
                });
            });
            
            qrPng.pipe(writeStream);
            
            writeStream.on('error', (error) => {
                console.error('❌ QR code generation failed:', error);
                reject(error);
            });
        });
    } catch (error) {
        console.error('❌ QR code generation error:', error);
        throw error;
    }
}

// Step 1: Create Payment Order (Following official documentation with fallback)
router.get('/verify/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('Verifying order:', orderId);

        let response;
        try {
            // Try with current environment
            response = await cashfree.PGOrderFetchPayments(orderId);
            console.log('Order verification response:', response.data);
        } catch (error) {
            // If failed and not using prod, try with prod credentials
            if (!isUsingProd && process.env.CASHFREE_PROD_CLIENT_ID) {
                console.log('🔄 Verification fallback to PRODUCTION...');
                initializeCashfree(true);
                response = await cashfree.PGOrderFetchPayments(orderId);
                console.log('Order verification response (fallback):', response.data);
            } else {
                throw error;
            }
        }

        res.json({
            success: true,
            data: response.data,
            environment: isUsingProd ? 'production' : 'sandbox'
        });

    } catch (error) {
        console.error('Order verification error:', error);
        
        if (error.response && error.response.data) {
            console.error('Cashfree error:', error.response.data);
            return res.status(400).json({
                success: false,
                message: error.response.data.message || 'Order verification failed',
                error: error.response.data
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error during order verification',
            error: error.message
        });
    }
});

// Alternative verification endpoint
router.post('/verify', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        let response;
        try {
            response = await cashfree.PGOrderFetchPayments(orderId);
        } catch (error) {
            if (!isUsingProd && process.env.CASHFREE_PROD_CLIENT_ID) {
                console.log('🔄 Verification fallback to PRODUCTION...');
                initializeCashfree(true);
                response = await cashfree.PGOrderFetchPayments(orderId);
            } else {
                throw error;
            }
        }
        
        res.json({
            success: true,
            data: response.data,
            environment: isUsingProd ? 'production' : 'sandbox'
        });

    } catch (error) {
        console.error('Order verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
});

// Get order status (Step 3: Confirming Payment with fallback)
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('Checking payment status for order:', orderId);

        let response;
        try {
            // Try with current environment first
            response = await cashfree.PGFetchOrder(orderId);
            console.log('Cashfree order status response:', response.data);
        } catch (error) {
            // If failed and not using prod, try with prod credentials
            if (!isUsingProd && process.env.CASHFREE_PROD_CLIENT_ID) {
                console.log('🔄 Status check fallback to PRODUCTION...');
                initializeCashfree(true);
                response = await cashfree.PGFetchOrder(orderId);
                console.log('Cashfree order status response (fallback):', response.data);
            } else {
                throw error;
            }
        }

        res.json({
            success: true,
            data: {
                orderId: orderId,
                paymentStatus: response.data.order_status === 'PAID' ? 'completed' : 'pending',
                totalAmount: response.data.order_amount,
                items: [{ itemName: `Order ${orderId}`, price: response.data.order_amount }],
                userRegistered: true,
                qrGenerated: true,
                emailSent: true,
                environment: isUsingProd ? 'production' : 'sandbox'
            }
        });

    } catch (error) {
        console.error('Get order status error:', error);
        
        if (error.response && error.response.data) {
            console.error('Cashfree error:', error.response.data);
            return res.status(400).json({
                success: false,
                message: error.response.data.message || 'Failed to fetch order status',
                error: error.response.data
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Payment success handler - processes completed payments and sends emails
router.get('/success/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('🎉 Processing payment success for order:', orderId);

        // Find the purchase record
        const purchase = await Purchase.findOne({ orderId: orderId });
        if (!purchase) {
            console.error('❌ Purchase not found for orderId:', orderId);
            return res.status(404).json({
                success: false,
                message: 'Purchase not found'
            });
        }

        // Check if payment is already processed
        if (purchase.paymentStatus === 'completed') {
            console.log('✅ Payment already processed for order:', orderId);
            return res.json({
                success: true,
                message: 'Payment already processed',
                purchase: purchase
            });
        }

        // Verify payment status with Cashfree
        let paymentStatus;
        try {
            const response = await cashfree.PGOrderFetchPayments(orderId);
            const payments = response.data;
            
            if (payments && payments.length > 0) {
                const latestPayment = payments[payments.length - 1];
                paymentStatus = latestPayment.payment_status;
                console.log('🔍 Payment status from Cashfree:', paymentStatus);
            } else {
                console.log('⚠️ No payment data found for order:', orderId);
                paymentStatus = 'pending';
            }
        } catch (error) {
            console.error('❌ Error verifying payment status:', error);
            paymentStatus = 'pending';
        }

        if (paymentStatus === 'SUCCESS') {
            console.log('✅ Payment confirmed as successful for order:', orderId);
            
            // Update purchase status to completed
            purchase.paymentStatus = 'completed';
            purchase.paymentCompletedAt = new Date();
            
            // Generate QR codes for ALL users associated with this purchase
            console.log('🔄 Starting QR code generation for all users in this purchase...');
            
            // Step 1: Generate QR code for main person (team leader)
            let user = await User.findOne({ email: purchase.userDetails.email });
            if (!user) {
                console.log('👤 Creating new user for email:', purchase.userDetails.email);
                user = new User({
                    name: purchase.userDetails.name,
                    email: purchase.userDetails.email,
                    contactNo: purchase.userDetails.contactNo || '',
                    isvalidated: true
                });
            }

            // Generate QR code for main person only if not already generated
            if (!user.qrCodeBase64) {
                try {
                    const qrCodeBase64 = await generateUserQRCode(user._id, {
                        name: user.name,
                        email: user.email,
                        events: user.events || []
                    });
                    user.qrPath = `${user._id}`;
                    user.qrCodeBase64 = qrCodeBase64;
                    console.log('✅ QR code generated for main person:', user._id);
                } catch (qrError) {
                    console.error('❌ QR code generation failed for main person:', qrError);
                }
            } else {
                console.log('ℹ️ QR code already exists for main person:', user._id);
            }

            await user.save();

            // Update purchase with user ID and QR info
            purchase.userId = user._id;
            purchase.qrGenerated = true;
            purchase.qrCodeBase64 = user.qrCodeBase64;
            
            // Save purchase with all updates
            await purchase.save();
            console.log('✅ Purchase status updated to completed for order:', orderId);

            // Step 3: Final check - Generate QR codes for any remaining users without QR codes
            console.log('🔍 Final check: Generating QR codes for any users without them...');
            try {
                // Find all users associated with this purchase who don't have QR codes
                const usersWithoutQR = await User.find({
                    $or: [
                        { email: purchase.userDetails.email },
                        { email: { $in: (purchase.userDetails.teamMembers || []).map(tm => tm.email) } }
                    ],
                    qrCodeBase64: { $exists: false }
                });

                for (const userWithoutQR of usersWithoutQR) {
                    try {
                        console.log(`🎫 Generating missing QR code for user: ${userWithoutQR.email}`);
                        
                        const qrCodeBase64 = await generateUserQRCode(userWithoutQR._id, {
                            name: userWithoutQR.name,
                            email: userWithoutQR.email,
                            events: userWithoutQR.events || []
                        });
                        
                        userWithoutQR.qrPath = `${userWithoutQR._id}`;
                        userWithoutQR.qrCodeBase64 = qrCodeBase64;
                        await userWithoutQR.save();
                        
                        console.log(`✅ Missing QR code generated for user: ${userWithoutQR._id} (${userWithoutQR.email})`);
                    } catch (qrError) {
                        console.error(`❌ Failed to generate missing QR code for ${userWithoutQR.email}:`, qrError);
                    }
                }
                
                console.log(`🎯 QR code generation complete. Processed ${usersWithoutQR.length} users without QR codes.`);
            } catch (finalQrError) {
                console.error('❌ Error in final QR code generation step:', finalQrError);
            }

            // Update team compositions for this user (if any)
            let teamMembers = [];
            try {
                console.log('🏆 Checking for team compositions to update for email:', user.email);
                
                // Find team compositions where this user is either team leader or team member
                const teamCompositions = await TeamComposition.find({
                    $or: [
                        { 'teamLeader.email': user.email },
                        { 'teamMembers.email': user.email }
                    ],
                    paymentStatus: 'pending'
                }).populate('teamMembers.userId', 'name email contactNo');
                
                if (teamCompositions.length > 0) {
                    console.log(`🎯 Found ${teamCompositions.length} team compositions to update`);
                    
                    // Extract team members for purchase record
                    const allTeamMembers = new Set();
                    
                    for (const teamComp of teamCompositions) {
                        teamComp.paymentStatus = 'completed';
                        teamComp.purchaseId = purchase._id;
                        teamComp.updatedAt = new Date();
                        
                        // Step 2: Generate QR codes for ALL team members
                        console.log(`🔄 Generating QR codes for team members in ${teamComp.teamName}...`);
                        
                        for (const member of teamComp.teamMembers) {
                            if (member.userId && member.userId.email !== user.email) {
                                try {
                                    // Find the team member user record
                                    const memberUser = await User.findById(member.userId._id);
                                    if (memberUser && !memberUser.qrCodeBase64) {
                                        console.log(`🎫 Generating QR code for team member: ${memberUser.email}`);
                                        
                                        const memberQrCodeBase64 = await generateUserQRCode(memberUser._id, {
                                            name: memberUser.name,
                                            email: memberUser.email,
                                            events: memberUser.events || []
                                        });
                                        
                                        memberUser.qrPath = `${memberUser._id}`;
                                        memberUser.qrCodeBase64 = memberQrCodeBase64;
                                        await memberUser.save();
                                        
                                        console.log(`✅ QR code generated for team member: ${memberUser._id} (${memberUser.email})`);
                                    } else if (memberUser && memberUser.qrCodeBase64) {
                                        console.log(`ℹ️ QR code already exists for team member: ${memberUser.email}`);
                                    }
                                } catch (memberQrError) {
                                    console.error(`❌ QR code generation failed for team member ${member.email}:`, memberQrError);
                                }
                                
                                // Collect team members for purchase record
                                allTeamMembers.add(JSON.stringify({
                                    name: member.userId.name,
                                    email: member.userId.email,
                                    contactNo: member.userId.contactNo || ''
                                }));
                            }
                        }
                        
                        await teamComp.save();
                        console.log(`✅ Updated team composition: ${teamComp.teamName} (${teamComp.eventName})`);
                    }
                    
                    // Convert Set back to array of objects
                    teamMembers = Array.from(allTeamMembers).map(memberStr => JSON.parse(memberStr));
                    
                    // Update purchase with team information
                    purchase.userDetails.teamMembers = teamMembers;
                    purchase.mainPersonId = user._id; // Set main person as team leader
                    console.log(`🎯 Added ${teamMembers.length} team members to purchase record`);
                    
                } else {
                    console.log('ℹ️ No pending team compositions found for this user');
                }
            } catch (teamError) {
                console.error('❌ Error updating team compositions:', teamError);
            }
            
            // Save purchase with team member updates
            await purchase.save();
            console.log('💾 Purchase saved with team member data');

            // Send registration email to team leader and all team members
            try {
                const emailData = {
                    name: user.name,
                    email: user.email,
                    events: user.events || ['Demo Event'],
                    qrCodeBase64: user.qrCodeBase64
                };

                // Send email to team leader (main person)
                const emailResult = await sendRegistrationEmail(user.email, emailData);
                if (emailResult.success) {
                    console.log('✅ Registration email sent successfully to team leader:', user.email);
                    user.emailSent = true;
                    user.emailSentAt = new Date();
                    await user.save();
                } else {
                    console.error('❌ Failed to send registration email to team leader:', emailResult.error);
                }

                // Send emails to all team members
                if (teamMembers && teamMembers.length > 0) {
                    console.log(`📧 Sending emails to ${teamMembers.length} team members...`);
                    
                    for (const teamMember of teamMembers) {
                        try {
                            // Find the team member's user record to get their QR code
                            const memberUser = await User.findOne({ email: teamMember.email });
                            if (memberUser) {
                                const memberEmailData = {
                                    name: memberUser.name,
                                    email: memberUser.email,
                                    events: memberUser.events || ['Demo Event'],
                                    qrCodeBase64: memberUser.qrCodeBase64
                                };

                                const memberEmailResult = await sendRegistrationEmail(memberUser.email, memberEmailData);
                                if (memberEmailResult.success) {
                                    console.log('✅ Registration email sent successfully to team member:', memberUser.email);
                                    memberUser.emailSent = true;
                                    memberUser.emailSentAt = new Date();
                                    await memberUser.save();
                                } else {
                                    console.error('❌ Failed to send registration email to team member:', memberUser.email, memberEmailResult.error);
                                }
                            } else {
                                console.warn('⚠️ Team member user not found for email:', teamMember.email);
                            }
                        } catch (memberEmailError) {
                            console.error('❌ Error sending email to team member:', teamMember.email, memberEmailError);
                        }
                    }
                }

                // Also send emails to support staff if any
                try {
                    const supportStaff = await User.find({
                        userType: 'support_staff',
                        events: { $in: user.events || [] },
                        emailSent: false
                    });

                    if (supportStaff.length > 0) {
                        console.log(`📧 Sending emails to ${supportStaff.length} support staff members...`);
                        
                        for (const supportUser of supportStaff) {
                            const supportEmailData = {
                                name: supportUser.name,
                                email: supportUser.email,
                                events: supportUser.events,
                                qrCodeBase64: supportUser.qrCodeBase64,
                                supportRole: supportUser.supportRole
                            };

                            const supportEmailResult = await sendRegistrationEmail(supportUser.email, supportEmailData);
                            if (supportEmailResult.success) {
                                console.log('✅ Registration email sent successfully to support staff:', supportUser.email);
                                supportUser.emailSent = true;
                                supportUser.emailSentAt = new Date();
                                await supportUser.save();
                            } else {
                                console.error('❌ Failed to send registration email to support staff:', supportUser.email, supportEmailResult.error);
                            }
                        }
                    }
                } catch (supportEmailError) {
                    console.error('❌ Error sending emails to support staff:', supportEmailError);
                }
            } catch (emailError) {
                console.error('❌ Email sending error:', emailError);
            }

            res.json({
                success: true,
                message: 'Payment processed successfully',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                },
                purchase: {
                    orderId: purchase.orderId,
                    status: purchase.paymentStatus
                }
            });
        } else {
            console.log('⏳ Payment still pending for order:', orderId);
            
            // Update purchase status to pending if not successful
            purchase.paymentStatus = 'pending';
            await purchase.save();
            
            res.json({
                success: true,
                message: 'Payment is still pending',
                status: 'pending'
            });
        }

    } catch (error) {
        console.error('❌ Payment success processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;
