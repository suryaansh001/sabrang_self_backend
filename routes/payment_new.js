const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Cashfree } = require('cashfree-pg');
const { User, Purchase } = require('../models/models');
const router = express.Router();

// Initialize Cashfree (version >= 5 correct approach)
console.log('Initializing Cashfree with credentials...');

// Set global credentials (this is the correct way for version >= 5)
const xClientId = process.env.CASHFREE_APP_ID;
const xClientSecret = process.env.CASHFREE_SECRET_KEY;

Cashfree.XClientId = xClientId;
Cashfree.XClientSecret = xClientSecret;
Cashfree.XEnvironment = process.env.NODE_ENV === 'production' 
    ? 'PRODUCTION'
    : 'SANDBOX';

console.log('Cashfree initialized:', {
    clientId: xClientId ? 'Set' : 'Not set',
    secretKey: xClientSecret ? 'Set' : 'Not set',
    environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'
});

// Generate unique order ID
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
        message: 'Payment routes working!',
        environment: process.env.NODE_ENV || 'development'
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

        // Create Cashfree order request (without order_id - Cashfree generates it)
        const orderRequest = {
            order_amount: finalAmount.toString(),
            order_currency: "INR",
            customer_details: {
                customer_id: userId,
                customer_phone: customerPhone || "9999999999",
                customer_name: customerName || "Customer",
                customer_email: customerEmail
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/payment/success?order_id={order_id}`,
                notify_url: `${process.env.BACKEND_URL}/api/payments/webhook`
            }
        };

        console.log('Cashfree order request:', orderRequest);

        // Create order with Cashfree (version >=5 - no version parameter needed)
        Cashfree.PGCreateOrder(orderRequest).then(response => {
            console.log('Cashfree response:', response.data);

            // Save order details to database
            const purchase = new Purchase({
                userId: userId,
                orderId: response.data.order_id, // Use Cashfree's generated order_id
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
                status: 'PENDING',
                cashfreeOrderId: response.data.order_id,
                createdAt: new Date()
            });

            purchase.save().then(() => {
                res.json({
                    success: true,
                    data: {
                        order_id: response.data.order_id,
                        payment_session_id: response.data.payment_session_id,
                        order_status: response.data.order_status,
                        amount: finalAmount,
                        currency: "INR"
                    }
                });
            }).catch(dbError => {
                console.error('Database save error:', dbError);
                res.status(500).json({
                    success: false,
                    message: 'Payment order created but failed to save to database',
                    error: dbError.message
                });
            });

        }).catch(error => {
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
        });

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

        // Fetch payment details from Cashfree (version >=5)
        Cashfree.PGOrderFetchPayments(orderId).then((response) => {
            console.log('Payment verification response:', response.data);

            // Update purchase record in database
            Purchase.findOne({ orderId: orderId }).then(purchase => {
                if (purchase) {
                    // Update payment status based on Cashfree response
                    const payments = response.data;
                    const successfulPayment = payments.find(payment => 
                        payment.payment_status === 'SUCCESS'
                    );

                    if (successfulPayment) {
                        purchase.status = 'SUCCESS';
                        purchase.paymentDetails = successfulPayment;
                        purchase.completedAt = new Date();
                        
                        // Update user's payment status
                        User.findByIdAndUpdate(purchase.userId, {
                            $set: { paymentStatus: 'completed' }
                        }).exec();
                    } else {
                        purchase.status = 'FAILED';
                    }

                    purchase.save().then(() => {
                        res.json({
                            success: true,
                            data: {
                                orderId: orderId,
                                paymentStatus: purchase.status,
                                payments: payments
                            }
                        });
                    }).catch(dbError => {
                        console.error('Database update error:', dbError);
                        res.status(500).json({
                            success: false,
                            message: 'Payment verified but failed to update database',
                            error: dbError.message
                        });
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: 'Order not found in database'
                    });
                }
            }).catch(dbError => {
                console.error('Database find error:', dbError);
                res.status(500).json({
                    success: false,
                    message: 'Database error while verifying payment',
                    error: dbError.message
                });
            });

        }).catch(error => {
            console.error('Payment verification error:', error);
            
            if (error.response && error.response.data) {
                console.error('Cashfree error:', error.response.data);
                return res.status(400).json({
                    success: false,
                    message: error.response.data.message || 'Payment verification failed',
                    error: error.response.data
                });
            }

            res.status(500).json({
                success: false,
                message: 'Internal server error during payment verification',
                error: error.message
            });
        });

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

        res.json({
            success: true,
            data: {
                orderId: purchase.orderId,
                status: purchase.status,
                amount: purchase.amount,
                customerDetails: purchase.customerDetails,
                createdAt: purchase.createdAt,
                completedAt: purchase.completedAt
            }
        });

    } catch (error) {
        console.error('Get order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Webhook for payment notifications (optional)
router.post('/webhook', async (req, res) => {
    try {
        console.log('Payment webhook received:', req.body);
        
        const { orderId, orderAmount, paymentStatus } = req.body;
        
        if (orderId) {
            const purchase = await Purchase.findOne({ orderId: orderId });
            
            if (purchase) {
                purchase.status = paymentStatus;
                purchase.webhookData = req.body;
                
                if (paymentStatus === 'SUCCESS') {
                    purchase.completedAt = new Date();
                    
                    // Update user payment status
                    await User.findByIdAndUpdate(purchase.userId, {
                        $set: { paymentStatus: 'completed' }
                    });
                }
                
                await purchase.save();
            }
        }
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
