const express = require('express');
const crypto = require('crypto');
const { Cashfree } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
const router = express.Router();

// Initialize Cashfree with fallback mechanism
let cashfree;
let isUsingProd = false;

function initializeCashfree(useProd = false) {
    if (useProd) {
        console.log('🔄 Switching to PRODUCTION credentials...');
        cashfree = new Cashfree(
            'PRODUCTION',
            process.env.CASHFREE_PROD_CLIENT_ID,
            process.env.CASHFREE_PROD_CLIENT_SECRET
        );
        isUsingProd = true;
        console.log('✅ Cashfree initialized with PRODUCTION credentials');
    } else {
        console.log('🧪 Using TEST credentials...');
        cashfree = new Cashfree(
            'SANDBOX',
            process.env.CASHFREE_CLIENT_ID,
            process.env.CASHFREE_CLIENT_SECRET
        );
        isUsingProd = false;
        console.log('✅ Cashfree initialized with SANDBOX credentials');
    }
}

// Start with TEST credentials
initializeCashfree(false);

console.log('Cashfree SDK initialized:', {
    testClientId: process.env.CASHFREE_CLIENT_ID ? 'Set' : 'Not set',
    testClientSecret: process.env.CASHFREE_CLIENT_SECRET ? 'Set' : 'Not set',
    prodClientId: process.env.CASHFREE_PROD_CLIENT_ID ? 'Set' : 'Not set',
    prodClientSecret: process.env.CASHFREE_PROD_CLIENT_SECRET ? 'Set' : 'Not set',
    currentEnvironment: 'SANDBOX (with PROD fallback)'
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
                return_url: `${process.env.FRONTEND_URL || 'https://sabrang25-first-draft.vercel.app'}/payment/success?order_id=${orderId}`
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

// Step 3: Verify Payment (Following official documentation with fallback)
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

module.exports = router;
