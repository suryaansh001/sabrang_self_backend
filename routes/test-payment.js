require("dotenv").config();
const express = require("express");
const router = express.Router();
const { Cashfree, CFEnvironment } = require("cashfree-pg");

// Initialize Cashfree for PRODUCTION testing
const environment = CFEnvironment.PRODUCTION;
const appId = process.env.CASHFREE_APP_ID;
const secretKey = process.env.CASHFREE_SECRET_KEY;

console.log('🔧 Cashfree Payment Gateway Configuration:', {
  environment: 'PRODUCTION',
  appId: appId ? appId.substring(0, 10) + '...' : 'Not set',
  hasSecretKey: !!secretKey,
  mode: 'Production Testing'
});

const cashfree = new Cashfree(environment, appId, secretKey);

// Test endpoint - no authentication required
router.post('/test-create-order', async (req, res) => {
  try {
    const { orderAmount, customerDetails } = req.body;

    console.log('📝 Test order creation request:', { orderAmount, customerDetails });

    // Validate input
    if (!orderAmount || !customerDetails) {
      return res.status(400).json({
        success: false,
        error: 'Order amount and customer details are required'
      });
    }

    if (!customerDetails.name || !customerDetails.email || !customerDetails.phone) {
      return res.status(400).json({
        success: false,
        error: 'Customer name, email, and phone are required'
      });
    }

    // Generate test order ID
    const orderId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create order request for Cashfree
    const orderRequest = {
      order_amount: parseFloat(orderAmount),
      order_currency: 'INR',
      order_id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customer_details: {
        customer_id: `test_customer_${Date.now()}`,
        customer_phone: customerDetails.phone,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email
      },
      order_meta: {
        return_url: 'https://sabrang25-first-draft.vercel.app/test-payment?order_id={order_id}',
        payment_methods: 'cc,dc,upi,nb,app,paylater'
      }
    };    console.log('📤 Sending order request to Cashfree:', orderRequest);

    // Test Cashfree connection
    const response = await cashfree.PGCreateOrder(orderRequest);

    console.log('✅ Cashfree response:', response.data);

    res.json({
      success: true,
      message: 'Test order created successfully',
      data: {
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: orderAmount,
        testMode: true
      }
    });

  } catch (error) {
    console.error('❌ Error creating test order:', error);
    
    // Provide detailed error information for testing
    const errorResponse = {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create test order',
      details: {
        code: error.response?.status || error.code,
        cashfreeError: error.response?.data || null,
        environment: process.env.NODE_ENV || 'development',
        cashfreeMode: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'
      }
    };

    res.status(500).json(errorResponse);
  }
});

// Test promo code validation - no authentication required
router.post('/test-validate-promo', async (req, res) => {
  try {
    const { promoCode, orderAmount } = req.body;

    console.log('📝 Test promo validation:', { promoCode, orderAmount });

    // Simple test validation
    const testPromoCodes = {
      'EARLYBIRD': { discountType: 'percentage', discountValue: 15, minAmount: 100, maxDiscount: 50 },
      'STUDENT50': { discountType: 'fixed', discountValue: 50, minAmount: 150 },
      'WELCOME10': { discountType: 'percentage', discountValue: 10, minAmount: 50, maxDiscount: 30 },
      'FESTIVAL25': { discountType: 'percentage', discountValue: 25, minAmount: 200, maxDiscount: 100 },
      'COMBO20': { discountType: 'fixed', discountValue: 20, minAmount: 100 }
    };

    const promo = testPromoCodes[promoCode?.toUpperCase()];

    if (!promo) {
      return res.json({
        success: false,
        error: 'Invalid promo code'
      });
    }

    if (orderAmount < promo.minAmount) {
      return res.json({
        success: false,
        error: `Minimum order amount is ₹${promo.minAmount}`
      });
    }

    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = (orderAmount * promo.discountValue) / 100;
      if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else {
      discountAmount = promo.discountValue;
    }

    discountAmount = Math.min(discountAmount, orderAmount);

    res.json({
      success: true,
      data: {
        discountAmount,
        finalAmount: orderAmount - discountAmount,
        promoCode: {
          code: promoCode.toUpperCase(),
          discountType: promo.discountType,
          discountValue: promo.discountValue
        }
      }
    });

  } catch (error) {
    console.error('❌ Error validating test promo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate promo code'
    });
  }
});

// Test Cashfree configuration
router.get('/test-config', (req, res) => {
  try {
    const config = {
      hasAppId: !!process.env.CASHFREE_APP_ID,
      hasSecretKey: !!process.env.CASHFREE_SECRET_KEY,
      environment: process.env.NODE_ENV || 'development',
      cashfreeMode: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
      frontendUrl: process.env.FRONTEND_URL || 'Not set'
    };

    console.log('🔧 Cashfree configuration check:', config);

    res.json({
      success: true,
      config,
      message: 'Configuration check completed'
    });

  } catch (error) {
    console.error('❌ Error checking config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check configuration'
    });
  }
});

module.exports = router;
