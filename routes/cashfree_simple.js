const express = require('express');
const { Cashfree } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
const router = express.Router();

// Initialize Cashfree following official documentation
// Since we have production credentials (cfsk_ma_prod_), we must use production
const cashfree = new Cashfree(
    'PRODUCTION', // Force production since we have prod credentials
    process.env.CASHFREE_CLIENT_ID,
    process.env.CASHFREE_CLIENT_SECRET
);

console.log('Cashfree Simple SDK initialized:', {
    clientId: process.env.CASHFREE_CLIENT_ID ? 'Set' : 'Not set',
    clientSecret: process.env.CASHFREE_CLIENT_SECRET ? 'Set' : 'Not set',
    environment: 'PRODUCTION (forced due to prod credentials)'
});

// Test route
router.get('/', (req, res) => {
    res.json({ 
        message: 'Cashfree Simple Payment Gateway Ready!',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Create payment order - Following Cashfree docs exactly
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

        // Generate unique order ID
        const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create order request following Cashfree documentation exactly
        const orderRequest = {
            order_id: orderId,
            order_amount: amount,
            order_currency: "INR",
            customer_details: {
                customer_id: `customer_${Date.now()}`,
                customer_name: customerName || "Customer",
                customer_email: customerEmail,
                customer_phone: customerPhone || "9999999999"
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL || 'https://sabrang25-first-draft.vercel.app'}/payment/success?order_id=${orderId}`
            },
            order_note: `Payment for order ${orderId}`
        };

        console.log('Cashfree order request:', orderRequest);

        // Create order with Cashfree
        const response = await cashfree.PGCreateOrder(orderRequest);
        console.log('Cashfree response:', response.data);

        res.json({
            success: true,
            data: {
                order_id: response.data.order_id,
                payment_session_id: response.data.payment_session_id,
                order_status: response.data.order_status,
                amount: amount,
                currency: "INR"
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        
        if (error.response && error.response.data) {
            console.error('Cashfree error:', error.response.data);
            return res.status(400).json({
                success: false,
                message: error.response.data.message || 'Payment order creation failed',
                error: error.response.data
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error while creating payment order',
            error: error.message
        });
    }
});

// Step 3: Verify Payment (Following official documentation)
router.get('/verify/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log('Verifying order:', orderId);

        // Fetch order status using official SDK
        const response = await cashfree.PGFetchOrder(orderId);
        console.log('Order verification response:', response.data);

        // Update database record
        const purchase = await Purchase.findOne({ orderId: orderId });
        if (purchase) {
            purchase.status = response.data.order_status;
            if (response.data.order_status === 'PAID') {
                purchase.completedAt = new Date();
                
                // Update user payment status
                await User.findByIdAndUpdate(purchase.userId, {
                    $set: { paymentStatus: 'completed' }
                });
            }
            await purchase.save();
        }

        res.json({
            success: true,
            data: {
                order_id: orderId,
                order_status: response.data.order_status,
                order_amount: response.data.order_amount,
                payment_session_id: response.data.payment_session_id
            }
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

        // Use the same verification logic
        const response = await cashfree.PGFetchOrder(orderId);
        
        res.json({
            success: true,
            data: response.data
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

// Get order status (Step 3: Confirming Payment)
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('Checking payment status for order:', orderId);

        // Fetch order status from Cashfree
        const response = await cashfree.PGFetchOrder(orderId);
        console.log('Cashfree order status response:', response.data);

        res.json({
            success: true,
            data: {
                orderId: orderId,
                order_status: response.data.order_status,
                order_amount: response.data.order_amount,
                order_currency: response.data.order_currency,
                created_at: response.data.created_at,
                customer_details: response.data.customer_details
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
