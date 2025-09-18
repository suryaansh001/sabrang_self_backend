const express = require('express');
const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
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
router.get('/', (req, res) => {
    res.json({ 
        message: 'Cashfree Simple Payment Gateway Ready!',
        environment: process.env.NODE_ENV || 'development'
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
            customerPhone
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
                return_url: `${(process.env.frontendurl || 'https://sabrang.jklu.edu.in').split(',')[0]}/payment/success?order_id=${orderId}`
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
            const parsedAmount = parseFloat(amount);
            const newPurchase = new Purchase({
                orderId: response.data.order_id,
                paymentSessionId: response.data.payment_session_id,
                userDetails: {
                    name: customerName,
                    email: customerEmail,
                    contactNo: customerPhone,
                    formData: req.body // Store complete request data
                },
                items: [{
                    type: 'event',
                    itemName: 'Demo Payment', // You can customize this based on the request
                    quantity: 1,
                    price: parsedAmount
                }],
                // Required by schema
                subtotal: parsedAmount,
                totalAmount: parsedAmount,
                // Optional extras (ignored if not in schema)
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

            await newPurchase.save();
            console.log('✅ Order saved to database:', response.data.order_id);

            // Generate QR code for the purchase using MongoDB ObjectID
            let qrCodeBase64 = null;
            try {
                const qrResult = await generateQRCode(newPurchase._id, {
                    name: customerName,
                    email: customerEmail,
                    orderId: response.data.order_id
                });
                
                // Read QR code file and convert to base64 for email
                if (fs.existsSync(qrResult.qrFilePath)) {
                    const qrBuffer = fs.readFileSync(qrResult.qrFilePath);
                    qrCodeBase64 = qrBuffer.toString('base64');
                    console.log('✅ QR code generated and converted to base64');
                }
                
                // Update purchase record with QR path
                newPurchase.qrPath = qrResult.qrPath;
                await newPurchase.save();
                
            } catch (qrError) {
                console.error('❌ Failed to generate QR code:', qrError.message);
                // Continue without QR code
            }

            // Send confirmation email with QR code
            try {
                const emailService = require('../utils/emailService');
                await emailService.sendPaymentInitiatedEmail({
                    email: customerEmail,
                    name: customerName,
                    orderId: response.data.order_id,
                    amount: amount,
                    paymentSessionId: response.data.payment_session_id,
                    environment: isUsingProd ? 'production' : 'sandbox',
                    qrCodeBase64: qrCodeBase64,
                    purchaseId: newPurchase._id
                });
                console.log('✅ Confirmation email sent to:', customerEmail);
            } catch (emailError) {
                console.error('❌ Failed to send email:', emailError.message);
                // Don't fail the order creation if email fails
            }

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
        const qrDir = path.join(__dirname, '../public/qrcodes');
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
        const qrRelativePath = `/public/qrcodes/${qrFilename}`;

        return new Promise((resolve, reject) => {
            const qrPng = qr.image(qrData, { type: 'png', size: 10 });
            const writeStream = fs.createWriteStream(qrPath);
            
            qrPng.pipe(writeStream);
            
            writeStream.on('finish', () => {
                console.log(`✅ QR code generated: ${qrRelativePath}`);
                resolve({ qrPath: qrRelativePath, qrFilePath: qrPath });
            });
            
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

        // Persist status to DB when possible
        try {
            const purchase = await Purchase.findOne({ orderId });
            if (Array.isArray(response.data) && response.data.length > 0) {
                const latest = response.data[0];
                if (purchase) {
                    if (latest.payment_status === 'SUCCESS') {
                        purchase.paymentStatus = 'completed';
                        purchase.paymentCompletedAt = new Date();
                        purchase.transactionId = latest.cf_payment_id;
                        purchase.paymentMethod = latest.payment_method || 'unknown';
                        await purchase.save();
                    } else if (latest.payment_status === 'FAILED') {
                        purchase.paymentStatus = 'failed';
                        await purchase.save();
                    }
                }
            } else {
                // Fallback: check order status directly
                const orderResp = await cashfree.PGFetchOrder(orderId);
                if (purchase && orderResp?.data?.order_status === 'PAID') {
                    purchase.paymentStatus = 'completed';
                    purchase.paymentCompletedAt = new Date();
                    await purchase.save();
                }
            }
        } catch (persistErr) {
            console.log('Non-fatal: failed to persist verify status:', persistErr.message);
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

        // Prefer DB state if available
        const purchase = await Purchase.findOne({ orderId });
        if (purchase) {
            return res.json({
                success: true,
                data: {
                    orderId: purchase.orderId,
                    paymentStatus: purchase.paymentStatus,
                    totalAmount: purchase.totalAmount,
                    items: purchase.items,
                    transactionId: purchase.transactionId,
                    userRegistered: purchase.userRegistered,
                    qrGenerated: purchase.qrGenerated,
                    emailSent: purchase.emailSent,
                    paymentCompletedAt: purchase.paymentCompletedAt,
                    environment: isUsingProd ? 'production' : 'sandbox'
                }
            });
        }

        // Fallback to Cashfree if no DB record found
        let response;
        try {
            response = await cashfree.PGFetchOrder(orderId);
            console.log('Cashfree order status response:', response.data);
        } catch (error) {
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
                userRegistered: false,
                qrGenerated: false,
                emailSent: false,
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

module.exports = router;
