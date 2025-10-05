const express = require('express');
const cors = require('cors');
const crypto = re        // Calculate final amount (apply any discounts)
        const finalAmount = Math.max(1, amount - appliedDiscount); // Minimum 1 INR

        // Generate unique order ID - use customer email if userId not available
        const orderId = actualUserId ? `order_${Date.now()}_${actualUserId}` : `order_${Date.now()}_${customerEmail.replace(/[^a-zA-Z0-9]/g, '')}`;('crypto');
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
        console.log('Create order request received with keys:', Object.keys(req.body));
        console.log('Items received:', req.body.items ? `${req.body.items.length} items` : 'no items');
        console.log('Visitor pass days:', req.body.visitorPassDays);
        console.log('Form data signatures:', req.body.formDataBySignature ? Object.keys(req.body.formDataBySignature).length : 0);
        
        const { 
            userId, 
            amount, 
            customerName, 
            customerEmail, 
            customerPhone,
            items,
            promoCode,
            appliedDiscount = 0,
            visitorPassDays,
            visitorPassDetails,
            formDataBySignature,
            teamMembersBySignature,
            flagshipBenefitsByEvent,
            metadata
        } = req.body;
        
        // Enhanced validation and user lookup
        let actualUserId = userId;
        let actualItems = items || [];
        
        // If userId is missing, try to find user by email
        if (!actualUserId && customerEmail) {
            try {
                const User = require('../models/models').User;
                const existingUser = await User.findOne({ email: customerEmail });
                if (existingUser) {
                    actualUserId = existingUser._id;
                    console.log(`🔍 Found existing user for email ${customerEmail}: ${actualUserId}`);
                    
                    // If items are missing but user has events, construct items from user events
                    if (actualItems.length === 0 && existingUser.events && existingUser.events.length > 0) {
                        actualItems = existingUser.events.map(eventName => ({
                            type: 'event',
                            itemName: eventName,
                            title: eventName,
                            quantity: 1,
                            price: parseFloat(amount) / existingUser.events.length // Distribute price evenly
                        }));
                        console.log(`🎯 Constructed items from user events: ${actualItems.map(i => i.itemName).join(', ')}`);
                    }
                }
            } catch (userLookupError) {
                console.log('⚠️ User lookup failed:', userLookupError.message);
            }
        }
        
        // If still no items but we have visitor pass data, add visitor pass item
        if (actualItems.length === 0 && visitorPassDays && parseInt(visitorPassDays) > 0) {
            actualItems = [{
                type: 'visitor_pass',
                itemName: 'VISITOR_PASS',
                title: 'Visitor Pass',
                quantity: parseInt(visitorPassDays),
                price: parseFloat(amount),
                days: parseInt(visitorPassDays)
            }];
            console.log(`🎫 Added visitor pass item: ${visitorPassDays} days`);
        }
        
        // If still no items, create a generic item to prevent empty array
        if (actualItems.length === 0) {
            actualItems = [{
                type: 'general',
                itemName: 'General Registration',
                title: 'General Registration',
                quantity: 1,
                price: parseFloat(amount)
            }];
            console.log(`⚠️ Created generic item as fallback`);
        }
        
        // Log final items for debugging
        console.log(`📦 Final items for processing:`, actualItems.map(item => ({
            itemName: item.itemName,
            type: item.type,
            price: item.price
        })));

        // Validate required fields with enhanced logic
        if (!amount || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, customerEmail'
            });
        }

        // Calculate final amount (apply any discounts)
        const finalAmount = Math.max(1, amount - appliedDiscount); // Minimum 1 INR

        // Generate unique order ID - use customer email if userId not available
        const orderId = actualUserId ? `order_${Date.now()}_${actualUserId}` : `order_${Date.now()}_${customerEmail.replace(/[^a-zA-Z0-9]/g, '')}`;

        // Create Cashfree order request with v5 API format
        const createOrderRequest = {
            order_id: orderId,
            order_amount: parseFloat(finalAmount.toFixed(2)),
            order_currency: "INR",
            order_note: `Payment for order ${orderId}`,
            customer_details: {
                customer_id: actualUserId ? actualUserId.toString() : customerEmail.replace(/[^a-zA-Z0-9]/g, ''),
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

            // Save order details to database with proper items structure
            const purchase = new Purchase({
                userId: actualUserId,
                orderId: response.data.order_id,
                amount: finalAmount,
                originalAmount: amount,
                appliedDiscount: appliedDiscount,
                promoCode: promoCode || null,
                items: actualItems, // Use properly constructed items
                userDetails: { // Add userDetails for compatibility with processSuccessfulPayment
                    name: customerName,
                    email: customerEmail,
                    contactNo: customerPhone,
                    formData: req.body, // Store complete request data
                    formsBySignature: req.body.formDataBySignature,
                    teamMembers: req.body.teamMembersBySignature,
                    flagshipBenefits: req.body.flagshipBenefitsByEvent,
                    visitorPassDays: req.body.visitorPassDays,
                    visitorPassDetails: req.body.visitorPassDetails
                },
                customerDetails: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone
                },
                paymentSessionId: response.data.payment_session_id,
                paymentStatus: 'pending', // Use consistent field name
                status: 'ACTIVE', // v5 uses ACTIVE instead of PENDING
                cashfreeOrderId: response.data.order_id,
                orderToken: response.data.order_token, // New field in v5
                metadata: req.body.metadata || {},
                purchaseDate: new Date(),
                createdAt: new Date()
            });

            console.log(`💾 Saving purchase with ${purchase.items.length} items:`, 
                purchase.items.map(item => item.itemName || item.title).join(', '));
            
            await purchase.save();
            
            console.log(`✅ Purchase saved successfully with order ID: ${purchase.orderId}`);

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
                    purchase.paymentStatus = 'completed'; // Set consistent status
                    
                    // Import and call the processSuccessfulPayment function
                    const directPaymentModule = require('./direct_payment_new');
                    const processSuccessfulPayment = directPaymentModule.processSuccessfulPayment;
                    
                    console.log(`🎉 Payment successful for order ${orderId}, processing user registration and QR generation...`);
                    
                    try {
                        const result = await processSuccessfulPayment(purchase);
                        if (result.success) {
                            console.log(`✅ Successfully processed payment for user: ${result.user.email}`);
                            purchase.userRegistered = true;
                            purchase.qrGenerated = true;
                            purchase.emailSent = true;
                        } else {
                            console.error(`❌ Failed to process payment: ${result.error}`);
                            purchase.registrationError = result.error;
                        }
                    } catch (processingError) {
                        console.error(`❌ Error processing successful payment:`, processingError);
                        purchase.registrationError = processingError.message;
                    }
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