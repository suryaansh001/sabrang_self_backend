require("dotenv").config();
const express = require("express");
const router = express.Router();
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const { User, Event, CheckoutOffer, PromoCode, Purchase } = require("../models/models");
const { verifyToken } = require("../middleware/auth");

// Initialize Cashfree
const cashfree = new Cashfree(
  process.env.NODE_ENV === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

// Utility functions
const generateOrderId = () => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9);
  return `sabrang_${timestamp}_${randomString}`;
};

const validatePromoCode = async (code, orderAmount, userId) => {
  try {
    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!promoCode) {
      return {
        isValid: false,
        error: 'Invalid or expired promo code'
      };
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      return {
        isValid: false,
        error: 'Promo code usage limit exceeded'
      };
    }

    // Check if user has already used this code
    const hasUsed = promoCode.usedBy.some(usage => usage.userId.toString() === userId);
    if (hasUsed) {
      return {
        isValid: false,
        error: 'You have already used this promo code'
      };
    }

    // Check minimum order amount
    if (orderAmount < promoCode.minOrderAmount) {
      return {
        isValid: false,
        error: `Minimum order amount is ₹${promoCode.minOrderAmount}`
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discountType === 'percentage') {
      discountAmount = (orderAmount * promoCode.discountValue) / 100;
      if (promoCode.maxDiscountAmount && discountAmount > promoCode.maxDiscountAmount) {
        discountAmount = promoCode.maxDiscountAmount;
      }
    } else {
      discountAmount = promoCode.discountValue;
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    return {
      isValid: true,
      discountAmount,
      finalAmount: orderAmount - discountAmount,
      promoCode
    };

  } catch (error) {
    console.error('Promo code validation error:', error);
    return {
      isValid: false,
      error: 'Error validating promo code'
    };
  }
};

// Create payment order
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { 
      orderAmount, 
      customerDetails, 
      selectedEvents, 
      selectedCombo,
      promoCode 
    } = req.body;

    const user = req.user;

    // Validate customer details
    if (!customerDetails || !customerDetails.name || !customerDetails.email || !customerDetails.phone) {
      return res.status(400).json({
        success: false,
        error: 'Customer details are required'
      });
    }

    // Generate unique order ID
    const orderId = generateOrderId();

    // Calculate final amount with promo code discount
    let finalAmount = orderAmount;
    let discountAmount = 0;
    let promoCodeData = null;

    if (promoCode) {
      const promoResult = await validatePromoCode(promoCode, orderAmount, user._id);
      if (promoResult.isValid) {
        finalAmount = promoResult.finalAmount;
        discountAmount = promoResult.discountAmount;
        promoCodeData = promoResult.promoCode;
      } else {
        return res.status(400).json({
          success: false,
          error: promoResult.error
        });
      }
    }

    // Create order request for Cashfree
    const orderRequest = {
      order_amount: finalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user._id.toString(),
        customer_phone: customerDetails.phone,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment/success?order_id={order_id}`,
        payment_methods: "cc,dc,upi,nb,wallet,emi"
      }
    };

    // Create order with Cashfree
    const response = await cashfree.PGCreateOrder(orderRequest);

    // Create purchase record in database
    const purchaseItems = [];
    
    // Add individual events
    if (selectedEvents && selectedEvents.length > 0) {
      for (const eventId of selectedEvents) {
        const event = await Event.findById(eventId);
        if (event) {
          purchaseItems.push({
            type: 'event',
            itemId: eventId,
            quantity: 1,
            price: event.price || 0
          });
        }
      }
    }

    // Add combo offer
    if (selectedCombo) {
      const offer = await CheckoutOffer.findById(selectedCombo);
      if (offer) {
        purchaseItems.push({
          type: 'offer',
          itemId: selectedCombo,
          quantity: 1,
          price: offer.comboPrice
        });
      }
    }

    const purchase = new Purchase({
      userId: user._id,
      items: purchaseItems,
      subtotal: orderAmount,
      promoCode: promoCodeData ? {
        code: promoCodeData.code,
        discountAmount
      } : null,
      totalAmount: finalAmount,
      paymentStatus: 'pending',
      transactionId: orderId
    });

    await purchase.save();

    res.json({
      success: true,
      data: {
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: finalAmount,
        originalAmount: orderAmount,
        discountAmount,
        purchaseId: purchase._id
      }
    });

  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to create order'
    });
  }
});

// Verify payment status
router.get('/verify', async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Get order payments from Cashfree
    const response = await cashfree.PGOrderFetchPayments(orderId);
    const payments = response.data;

    let orderStatus = 'FAILED';
    
    // Analyze payment status
    if (payments.filter(payment => payment.payment_status === 'SUCCESS').length > 0) {
      orderStatus = 'SUCCESS';
    } else if (payments.filter(payment => payment.payment_status === 'PENDING').length > 0) {
      orderStatus = 'PENDING';
    } else {
      orderStatus = 'FAILED';
    }

    // Update purchase record in database
    const purchase = await Purchase.findOne({ transactionId: orderId });
    if (purchase) {
      purchase.paymentStatus = orderStatus.toLowerCase();
      
      // If payment is successful, update user's events and promo code usage
      if (orderStatus === 'SUCCESS') {
        const user = await User.findById(purchase.userId);
        
        // Add events to user's registered events
        for (const item of purchase.items) {
          if (item.type === 'event') {
            const event = await Event.findById(item.itemId);
            if (event && !user.events.includes(event.name)) {
              user.events.push(event.name);
            }
          } else if (item.type === 'offer') {
            const offer = await CheckoutOffer.findById(item.itemId);
            if (offer) {
              for (const offerEvent of offer.events) {
                const event = await Event.findById(offerEvent.eventId);
                if (event && !user.events.includes(event.name)) {
                  user.events.push(event.name);
                }
              }
            }
          }
        }
        
        await user.save();

        // Update promo code usage if applicable
        if (purchase.promoCode && purchase.promoCode.code) {
          await PromoCode.findOneAndUpdate(
            { code: purchase.promoCode.code },
            {
              $inc: { usedCount: 1 },
              $push: {
                usedBy: {
                  userId: purchase.userId,
                  usedAt: new Date(),
                  orderAmount: purchase.subtotal,
                  discountApplied: purchase.promoCode.discountAmount
                }
              }
            }
          );
        }
      }

      await purchase.save();
    }

    res.json({
      success: true,
      data: {
        orderId,
        orderStatus,
        payments,
        purchase
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to verify payment'
    });
  }
});

// Validate promo code endpoint
router.post('/validate-promo', verifyToken, async (req, res) => {
  try {
    const { promoCode, orderAmount } = req.body;
    const user = req.user;

    if (!promoCode || !orderAmount) {
      return res.status(400).json({
        success: false,
        error: 'Promo code and order amount are required'
      });
    }

    const result = await validatePromoCode(promoCode, orderAmount, user._id);

    if (result.isValid) {
      res.json({
        success: true,
        data: {
          discountAmount: result.discountAmount,
          finalAmount: result.finalAmount,
          promoCode: {
            code: result.promoCode.code,
            discountType: result.promoCode.discountType,
            discountValue: result.promoCode.discountValue
          }
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate promo code'
    });
  }
});

// Get user's purchase history
router.get('/purchases', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    const purchases = await Purchase.find({ userId: user._id })
      .populate('items.itemId')
      .sort({ purchaseDate: -1 });

    res.json({
      success: true,
      data: purchases
    });

  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase history'
    });
  }
});

// Webhook endpoint for Cashfree notifications
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature (implement based on Cashfree documentation)
    const { order_id, order_status } = req.body;

    // Update purchase record
    const purchase = await Purchase.findOne({ transactionId: order_id });
    if (purchase) {
      purchase.paymentStatus = order_status.toLowerCase();
      await purchase.save();

      // If payment successful, update user events
      if (order_status === 'PAID') {
        const user = await User.findById(purchase.userId);
        
        for (const item of purchase.items) {
          if (item.type === 'event') {
            const event = await Event.findById(item.itemId);
            if (event && !user.events.includes(event.name)) {
              user.events.push(event.name);
            }
          }
        }
        
        await user.save();
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
