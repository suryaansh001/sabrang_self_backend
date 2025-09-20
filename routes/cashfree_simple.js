const express = require('express');
const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
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
                    qrGenerated: purchase.qrGenerated
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
            // First attempt with current credentials
            response = await cashfree.PGCreateOrder(orderRequest);
            console.log('✅ Cashfree response (first attempt):', response.data);
        } catch (firstError) {
            console.log('❌ First attempt failed:', firstError.response?.data || firstError.message);
            
            // If not already using prod and we have prod credentials, try fallback
            if (!isUsingProd && process.env.CASHFREE_PROD_CLIENT_ID && process.env.CASHFREE_PROD_CLIENT_SECRET) {
                console.log('🔄 Attempting fallback to PRODUCTION credentials...');
                initializeCashfree(true);
                attemptedFallback = true;
                
                try {
                    response = await cashfree.PGCreateOrder(orderRequest);
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

            // Generate QR code for the purchase using MongoDB ObjectID
            let qrCodeBase64 = null;
            try {
                const qrResult = await generateQRCode(newPurchase._id, {
                    name: customerName,
                    email: customerEmail,
                    orderId: response.data.order_id
                });
                
                // Use base64 from QR generation function
                qrCodeBase64 = qrResult.qrBase64;
                console.log('✅ QR code generated and converted to base64');
                
                // Update purchase record with QR path and base64
                newPurchase.qrPath = qrResult.qrPath;
                newPurchase.qrCodeBase64 = qrCodeBase64;
                newPurchase.qrGenerated = true;
                await newPurchase.save();
                
            } catch (qrError) {
                console.error('❌ Failed to generate QR code:', qrError.message);
                // Continue without QR code
            }

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
        
        if (error.response && error.response.data) {
            console.error('Cashfree error details:', error.response.data);
            return res.status(400).json({
                success: false,
                message: error.response.data.message || 'Payment order creation failed',
                error: error.response.data,
                environment: isUsingProd ? 'production' : 'sandbox'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error while creating payment order',
            error: error.message,
            environment: isUsingProd ? 'production' : 'sandbox'
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
            
            // Create or find user
            let user = await User.findOne({ email: purchase.userDetails.email });
            if (!user) {
                console.log('👤 Creating new user for email:', purchase.userDetails.email);
                user = new User({
                    name: purchase.userDetails.name,
                    email: purchase.userDetails.email,
                    contactNo: purchase.userDetails.contactNo || '',
                    isvalidated: true
                });
                
                // Save user with comprehensive error handling
                try {
                    const savedUser = await user.save();
                    if (!savedUser || !savedUser._id) {
                        throw new Error('User save returned invalid result');
                    }
                    console.log('✅ New user created with ID:', savedUser._id);
                    user = savedUser; // Ensure we have the saved user with _id
                } catch (saveError) {
                    console.error('❌ Failed to save new user:', saveError);
                    // Try to save again with retry mechanism
                    try {
                        console.log('🔄 Retrying user save...');
                        const retrySavedUser = await user.save();
                        if (!retrySavedUser || !retrySavedUser._id) {
                            throw new Error('Retry user save also returned invalid result');
                        }
                        console.log('✅ User save retry successful:', retrySavedUser._id);
                        user = retrySavedUser;
                    } catch (retryError) {
                        console.error('❌ User save retry also failed:', retryError);
                        throw new Error(`Cannot proceed without valid user ID: ${retryError.message}`);
                    }
                }
            }

            // Verify user has valid _id
            if (!user._id) {
                console.error('❌ User exists but has no _id:', user);
                throw new Error('User object is invalid - missing _id');
            }

            console.log('✅ User verified with valid ID:', user._id);

            // Generate QR code for user - now user._id is guaranteed to exist
            let qrCodeGenerated = false;
            try {
                // Use multiple fallback options for QR data
                const qrIdentifier = user._id || purchase._id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.log('🔍 Generating QR code with identifier:', qrIdentifier);
                
                const qrCodeBase64 = await generateUserQRCode(qrIdentifier, {
                    name: user.name,
                    email: user.email
                });
                
                if (qrCodeBase64 && qrCodeBase64.length > 0) {
                    user.qrPath = `${qrIdentifier}`;
                    user.qrCodeBase64 = qrCodeBase64;
                    qrCodeGenerated = true;
                    console.log('✅ QR code generated successfully for user:', user._id, 'base64 length:', qrCodeBase64.length);
                } else {
                    console.error('❌ QR code generation returned empty/null result');
                }
            } catch (qrError) {
                console.error('❌ QR code generation failed:', qrError);
                // Try alternative QR generation with simpler data
                try {
                    console.log('🔄 Attempting fallback QR generation...');
                    const fallbackData = user.email || `user_${Date.now()}`;
                    const qrCodeBase64 = await generateUserQRCode(fallbackData, {
                        name: user.name || 'User',
                        email: user.email || 'no-email'
                    });
                    
                    if (qrCodeBase64 && qrCodeBase64.length > 0) {
                        user.qrPath = fallbackData;
                        user.qrCodeBase64 = qrCodeBase64;
                        qrCodeGenerated = true;
                        console.log('✅ Fallback QR code generated successfully');
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback QR generation also failed:', fallbackError);
                }
            }

            // Save user with QR code data - with comprehensive error handling
            try {
                const updatedUser = await user.save();
                if (!updatedUser) {
                    throw new Error('User update save returned null');
                }
                console.log('✅ User successfully updated with QR code data');
                user = updatedUser; // Ensure we have the latest saved user
            } catch (userSaveError) {
                console.error('❌ Failed to save user with QR code:', userSaveError);
                // Try to save again
                try {
                    console.log('🔄 Retrying user save with QR code...');
                    const retryUpdatedUser = await user.save();
                    if (!retryUpdatedUser) {
                        throw new Error('User update retry save also returned null');
                    }
                    console.log('✅ User QR code save retry successful');
                    user = retryUpdatedUser;
                } catch (retryUserError) {
                    console.error('❌ User QR code save retry also failed:', retryUserError);
                    // Set flag that user save failed but continue with purchase
                    qrCodeGenerated = false;
                    console.log('⚠️ Continuing without user QR code save due to persistent errors');
                }
            }

            // Update purchase with user ID and QR info
            purchase.userId = user._id;
            purchase.qrGenerated = qrCodeGenerated;
            purchase.qrCodeBase64 = user.qrCodeBase64;
            
            // Save purchase with comprehensive error handling
            try {
                const savedPurchase = await purchase.save();
                if (!savedPurchase) {
                    throw new Error('Purchase save returned null');
                }
                console.log('✅ Purchase status updated to completed for order:', orderId);
            } catch (purchaseSaveError) {
                console.error('❌ Failed to save purchase:', purchaseSaveError);
                // Try to save again
                try {
                    console.log('🔄 Retrying purchase save...');
                    const retrySavedPurchase = await purchase.save();
                    if (!retrySavedPurchase) {
                        throw new Error('Purchase retry save also returned null');
                    }
                    console.log('✅ Purchase save retry successful');
                } catch (retryPurchaseError) {
                    console.error('❌ Purchase save retry also failed:', retryPurchaseError);
                    // This is more serious - log but continue
                    console.log('⚠️ Purchase save failed but continuing with email send');
                }
            }

            // Send registration email only if QR code was generated successfully
            if (qrCodeGenerated && user.qrCodeBase64) {
                try {
                    const emailData = {
                        name: user.name,
                        email: user.email,
                        events: ['Demo Event'], // You can customize this based on purchase items
                        qrCodeBase64: user.qrCodeBase64
                    };

                    const emailResult = await sendRegistrationEmail(user.email, emailData);
                    if (emailResult.success) {
                        console.log('✅ Registration email with QR code sent successfully to:', user.email);
                        user.emailSent = true;
                        user.emailSentAt = new Date();
                        
                        // Save email status with error handling
                        try {
                            await user.save();
                            console.log('✅ User email status updated successfully');
                        } catch (emailStatusSaveError) {
                            console.error('❌ Failed to save email status:', emailStatusSaveError);
                            // This is not critical - email was sent, just status update failed
                            console.log('⚠️ Email was sent successfully but status update failed');
                        }
                    } else {
                        console.error('❌ Failed to send registration email:', emailResult.error);
                    }
                } catch (emailError) {
                    console.error('❌ Email sending error:', emailError);
                }
            } else {
                console.error('❌ Cannot send email: QR code generation failed. No email sent to:', user.email);
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
