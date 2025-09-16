const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Cashfree } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
const router = express.Router();

// Initialize Cashfree with v5 API
Cashfree.XClientId = process.env.CASHFREE_CLIENT_ID; // Updated environment variable name
Cashfree.XClientSecret = process.env.CASHFREE_CLIENT_SECRET; // Updated environment variable name
Cashfree.XEnvironment = process.env.NODE_ENV === 'production' 
    ? 'PRODUCTION'
    : 'SANDBOX';

console.log('Cashfree v5 initialized:', {
    clientId: process.env.CASHFREE_CLIENT_ID ? 'Set' : 'Not set',
    clientSecret: process.env.CASHFREE_CLIENT_SECRET ? 'Set' : 'Not set',
    environment: Cashfree.XEnvironment
});

// Test route
router.get('/', (req, res) => {
    res.json({ 
        message: 'Payment routes working with Cashfree v5 API!',
        environment: process.env.NODE_ENV || 'development',
        apiVersion: '2023-08-01' // Updated API version
    });
});

// Create payment order
router.post('/create-order', async (req, res) => {
    try {
        console.log('Create order request:', req.body);
        
        const { 
            userId, 
            amount, 
            customerName, 
            customerEmail, 
            customerPhone,
            items,
            promoCode,
            appliedDiscount = 0
        } = req.body;

        // Validate required fields
        if (!userId || !amount || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, amount, customerEmail'
            });
        }

        // Calculate final amount (apply any discounts)
        const finalAmount = Math.max(1, amount - appliedDiscount); // Minimum 1 INR

        // Generate unique order ID
        const orderId = `order_${Date.now()}_${userId}`;

        // Create Cashfree order request with v5 API format
        const createOrderRequest = {
            order_id: orderId,
            order_amount: parseFloat(finalAmount.toFixed(2)),
            order_currency: "INR",
            order_note: `Payment for order ${orderId}`,
            customer_details: {
                customer_id: userId.toString(),
                customer_name: customerName || "Customer",
                customer_email: customerEmail,
                customer_phone: customerPhone || "9999999999"
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/payment/success?order_id={order_id}`,
                notify_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
                payment_methods: "" // Leave empty to allow all payment methods
            },
            order_expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        };

        console.log('Cashfree v5 order request:', createOrderRequest);

        try {
            // Create order with Cashfree v5 API
            const response = await Cashfree.PGCreateOrder("2023-08-01", createOrderRequest);
            console.log('Cashfree v5 response:', response.data);

            // Save order details to database
            const purchase = new Purchase({
                userId: userId,
                orderId: response.data.order_id,
                amount: finalAmount,
                originalAmount: amount,
                appliedDiscount: appliedDiscount,
                promoCode: promoCode || null,
                items: items || [],
                customerDetails: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone
                },
                paymentSessionId: response.data.payment_session_id,
                status: 'ACTIVE', // v5 uses ACTIVE instead of PENDING
                cashfreeOrderId: response.data.order_id,
                orderToken: response.data.order_token, // New field in v5
                createdAt: new Date()
            });

            await purchase.save();

            res.json({
                success: true,
                data: {
                    order_id: response.data.order_id,
                    payment_session_id: response.data.payment_session_id,
                    order_token: response.data.order_token, // Required for v5 checkout
                    order_status: response.data.order_status,
                    amount: finalAmount,
                    currency: "INR",
                    cf_order_id: response.data.cf_order_id // Cashfree's internal order ID
                }
            });

        } catch (cashfreeError) {
            console.error('Cashfree API error:', cashfreeError);
            
            if (cashfreeError.response && cashfreeError.response.data) {
                console.error('Cashfree error details:', cashfreeError.response.data);
                return res.status(400).json({
                    success: false,
                    message: cashfreeError.response.data.message || 'Payment order creation failed',
                    error: cashfreeError.response.data
                });
            }

            res.status(500).json({
                success: false,
                message: 'Internal server error while creating payment order',
                error: cashfreeError.message
            });
        }

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating payment order',
            error: error.message
        });
    }
});

// Verify payment
router.post('/verify', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        console.log('Verifying payment for order:', orderId);

        try {
            // Fetch order details from Cashfree v5 API
            const orderResponse = await Cashfree.PGFetchOrder("2023-08-01", orderId);
            console.log('Order details:', orderResponse.data);

            // Fetch payment details from Cashfree v5 API
            const paymentsResponse = await Cashfree.PGOrderFetchPayments("2023-08-01", orderId);
            console.log('Payment verification response:', paymentsResponse.data);

            // Update purchase record in database
            const purchase = await Purchase.findOne({ orderId: orderId });
            
            if (!purchase) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found in database'
                });
            }

            // Update payment status based on Cashfree v5 response
            const payments = paymentsResponse.data;
            const orderStatus = orderResponse.data.order_status;
            
            const successfulPayment = payments.find(payment => 
                payment.payment_status === 'SUCCESS'
            );

            if (successfulPayment && orderStatus === 'PAID') {
                purchase.status = 'PAID'; // v5 uses PAID instead of SUCCESS
                purchase.paymentDetails = successfulPayment;
                purchase.completedAt = new Date();
                
                // Update user's payment status
                await User.findByIdAndUpdate(purchase.userId, {
                    $set: { paymentStatus: 'completed' }
                });
            } else if (orderStatus === 'EXPIRED' || orderStatus === 'CANCELLED') {
                purchase.status = orderStatus;
            } else {
                // Check for failed payments
                const failedPayment = payments.find(payment => 
                    payment.payment_status === 'FAILED'
                );
                if (failedPayment) {
                    purchase.status = 'FAILED';
                }
            }

            await purchase.save();

            res.json({
                success: true,
                data: {
                    orderId: orderId,
                    orderStatus: orderStatus,
                    paymentStatus: purchase.status,
                    payments: payments,
                    orderDetails: orderResponse.data
                }
            });

        } catch (cashfreeError) {
            console.error('Payment verification error:', cashfreeError);
            
            if (cashfreeError.response && cashfreeError.response.data) {
                console.error('Cashfree error:', cashfreeError.response.data);
                return res.status(400).json({
                    success: false,
                    message: cashfreeError.response.data.message || 'Payment verification failed',
                    error: cashfreeError.response.data
                });
            }

            res.status(500).json({
                success: false,
                message: 'Internal server error during payment verification',
                error: cashfreeError.message
            });
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during payment verification',
            error: error.message
        });
    }
});

// Get order status
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find order in database
        const purchase = await Purchase.findOne({ orderId: orderId });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Also fetch latest status from Cashfree if needed
        try {
            const cashfreeResponse = await Cashfree.PGFetchOrder("2023-08-01", orderId);
            
            // Update local status if different
            if (cashfreeResponse.data.order_status !== purchase.status) {
                purchase.status = cashfreeResponse.data.order_status;
                await purchase.save();
            }

            res.json({
                success: true,
                data: {
                    orderId: purchase.orderId,
                    status: purchase.status,
                    amount: purchase.amount,
                    customerDetails: purchase.customerDetails,
                    createdAt: purchase.createdAt,
                    completedAt: purchase.completedAt,
                    cashfreeStatus: cashfreeResponse.data.order_status,
                    orderToken: purchase.orderToken
                }
            });

        } catch (cashfreeError) {
            // If Cashfree API fails, return database status
            console.warn('Could not fetch latest status from Cashfree:', cashfreeError.message);
            
            res.json({
                success: true,
                data: {
                    orderId: purchase.orderId,
                    status: purchase.status,
                    amount: purchase.amount,
                    customerDetails: purchase.customerDetails,
                    createdAt: purchase.createdAt,
                    completedAt: purchase.completedAt,
                    orderToken: purchase.orderToken
                }
            });
        }

    } catch (error) {
        console.error('Get order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Enhanced webhook for payment notifications with signature verification
router.post('/webhook', async (req, res) => {
    try {
        console.log('Payment webhook received:', req.body);
        console.log('Webhook headers:', req.headers);
        
        // Verify webhook signature (recommended for production)
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        
        if (signature && timestamp) {
            // Verify signature using webhook secret
            const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
            if (webhookSecret) {
                const expectedSignature = crypto
                    .createHmac('sha256', webhookSecret)
                    .update(timestamp + '.' + JSON.stringify(req.body))
                    .digest('hex');
                
                if (signature !== expectedSignature) {
                    console.error('Invalid webhook signature');
                    return res.status(401).json({ success: false, message: 'Invalid signature' });
                }
            }
        }
        
        const { 
            order: { order_id: orderId, order_amount: orderAmount },
            payment: { payment_status: paymentStatus, payment_method, cf_payment_id }
        } = req.body.data || {};
        
        if (orderId) {
            const purchase = await Purchase.findOne({ orderId: orderId });
            
            if (purchase) {
                purchase.status = paymentStatus === 'SUCCESS' ? 'PAID' : paymentStatus;
                purchase.webhookData = req.body;
                
                if (paymentStatus === 'SUCCESS') {
                    purchase.completedAt = new Date();
                    purchase.paymentMethod = payment_method;
                    purchase.cfPaymentId = cf_payment_id;
                    
                    // Update user payment status
                    await User.findByIdAndUpdate(purchase.userId, {
                        $set: { paymentStatus: 'completed' }
                    });
                }
                
                await purchase.save();
                console.log('Purchase updated via webhook:', purchase.orderId, purchase.status);
            } else {
                console.warn('Order not found in database:', orderId);
            }
        }
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// New route: Cancel order (v5 feature)
router.post('/cancel/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Cancel order in Cashfree
        const cancelResponse = await Cashfree.PGCancelOrder("2023-08-01", orderId);
        
        // Update local database
        const purchase = await Purchase.findOne({ orderId: orderId });
        if (purchase) {
            purchase.status = 'CANCELLED';
            purchase.cancelledAt = new Date();
            await purchase.save();
        }

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            data: cancelResponse.data
        });

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order',
            error: error.message
        });
    }
});

// New route: Fetch settlements (v5 feature)
router.get('/settlements', async (req, res) => {
    try {
        const { start_date, end_date, limit = 50 } = req.query;
        
        const settlementsResponse = await Cashfree.PGFetchSettlements("2023-08-01", {
            limit: parseInt(limit),
            start_date,
            end_date
        });

        res.json({
            success: true,
            data: settlementsResponse.data
        });

    } catch (error) {
        console.error('Fetch settlements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settlements',
            error: error.message
        });
    }
});

module.exports = router;