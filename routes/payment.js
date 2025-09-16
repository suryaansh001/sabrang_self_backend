const express = require('express');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { Purchase, User, Event, TeamMember, PromoCode } = require('../models/models');
const { sendRegistrationEmail } = require('../utils/emailService');
const shortid = require('shortid');
const qr = require('qr-image');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const router = express.Router();

// Initialize Cashfree
const cashfree = new Cashfree(
  CFEnvironment.PRODUCTION, 
  process.env.CASHFREE_APP_ID, 
  process.env.CASHFREE_SECRET_KEY
);

// Validate promo code endpoint
router.post('/validate-promo', async (req, res) => {
  try {
    const { code, userEmail, orderAmount } = req.body;

    if (!code || !userEmail || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    const currentDate = new Date();
    
    // Check validity period
    if (currentDate < promoCode.validFrom || currentDate > promoCode.validUntil) {
      return res.json({
        success: false,
        message: 'Promo code has expired'
      });
    }

    // Check usage limit
    if (promoCode.usedCount >= promoCode.usageLimit) {
      return res.json({
        success: false,
        message: 'Promo code usage limit exceeded'
      });
    }

    // Check minimum order amount
    if (orderAmount < promoCode.minOrderAmount) {
      return res.json({
        success: false,
        message: `Minimum order amount is ₹${promoCode.minOrderAmount}`
      });
    }

    // Check email domain restriction
    if (promoCode.allowedEmailDomains.length > 0) {
      const userDomain = userEmail.split('@')[1];
      if (!promoCode.allowedEmailDomains.includes(userDomain)) {
        return res.json({
          success: false,
          message: 'This promo code is not valid for your email domain'
        });
      }
    }

    // Calculate discount
    let discountAmount;
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

    res.json({
      success: true,
      message: 'Promo code is valid',
      discountAmount,
      finalAmount: orderAmount - discountAmount
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create order and payment session (updated to match Cashfree docs)
router.post('/create-session', async (req, res) => {
  try {
    console.log('� Creating Cashfree order and payment session');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    const { 
      userDetails,
      items,
      totalAmount,
      promoCode,
      metadata 
    } = req.body;

    // Validate input
    if (!userDetails || !userDetails.email || !userDetails.name) {
      console.log('❌ Validation failed: Missing user details');
      return res.status(400).json({ 
        success: false, 
        message: 'User details are required' 
      });
    }

    if (!items || items.length === 0) {
      console.log('❌ Validation failed: No events selected');
      return res.status(400).json({ 
        success: false, 
        message: 'No events selected' 
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      console.log('❌ Validation failed: Invalid amount');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    console.log('✅ Input validation passed');

    // Generate unique order ID
    const orderId = `SABRANG_${shortid.generate()}_${Date.now()}`;
    console.log('🆔 Generated order ID:', orderId);

    // Calculate amounts
    const subtotal = promoCode?.discountAmount ? totalAmount + promoCode.discountAmount : totalAmount;
    const finalAmount = totalAmount;
    console.log('💰 Amount calculation:', { subtotal, finalAmount, promoCode });

    console.log('💾 Creating purchase record...');
    // Create purchase record with all details
    const purchase = new Purchase({
      orderId: orderId,
      userId: null, // Will be set after user registration
      userDetails: {
        name: userDetails.name,
        email: userDetails.email,
        contactNo: userDetails.contactNo,
        gender: userDetails.gender,
        age: userDetails.age,
        universityName: userDetails.universityName,
        address: userDetails.address,
        formData: userDetails.formData || {},
        teamMembers: userDetails.teamMembers || []
      },
      items: items.map(item => ({
        type: 'event',
        itemId: item.eventId,
        itemName: item.eventName,
        price: item.price,
        quantity: 1
      })),
      subtotal: subtotal,
      promoCode: promoCode ? {
        code: promoCode.code,
        discountAmount: promoCode.discountAmount
      } : null,
      totalAmount: finalAmount,
      paymentStatus: 'pending',
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        source: metadata?.source || 'checkout',
        ...metadata
      }
    });

    await purchase.save();
    console.log('✅ Purchase record saved with ID:', purchase._id);

    // Create Cashfree order request (as per docs)
    const cashfreeRequest = {
      order_amount: finalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: `customer_${Date.now()}`,
        customer_name: userDetails.name,
        customer_email: userDetails.email,
        customer_phone: userDetails.contactNo || "9999999999"
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || process.env.frontendurl || 'http://localhost:3000'}/payment/success?order_id={order_id}`,
        payment_methods: "cc,dc,upi,nb,wallet"
      }
    };

    console.log('🔄 Creating Cashfree order with:', JSON.stringify(cashfreeRequest, null, 2));

    // Create order with Cashfree (server-side as per docs)
    const response = await cashfree.PGCreateOrder(cashfreeRequest);
    console.log('📨 Cashfree response:', JSON.stringify(response, null, 2));
    
    if (response.data && response.data.payment_session_id) {
      // Update purchase with payment session ID
      purchase.paymentSessionId = response.data.payment_session_id;
      purchase.cashfreeOrderId = response.data.order_id;
      await purchase.save();

      console.log('✅ Order created successfully:', {
        orderId,
        sessionId: response.data.payment_session_id,
        amount: finalAmount
      });

      res.json({
        success: true,
        data: {
          paymentSessionId: response.data.payment_session_id,
          orderId: orderId,
          amount: finalAmount,
          cashfreeOrderId: response.data.order_id
        }
      });
    } else {
      console.log('❌ Invalid Cashfree response structure:', response);
      throw new Error('Failed to create order with Cashfree - invalid response structure');
    }

  } catch (error) {
    console.error('❌ Cashfree order creation error:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log specific Cashfree errors
    if (error.response) {
      console.error('Cashfree API Error Response:', error.response.data);
      console.error('Cashfree API Status:', error.response.status);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create Cashfree order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        cashfreeError: error.response?.data
      } : undefined
    });
  }
});

// Fetch payment details from Cashfree (as per docs)
router.get('/fetch-payments/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Fetching payment details for order: ${orderId}`);
    
    // Fetch payment details from Cashfree (as per docs)
    const response = await cashfree.PGOrderFetchPayments(orderId);
    
    if (response.data) {
      console.log('✅ Payment details fetched successfully:', response.data);
      
      res.json({
        success: true,
        data: response.data
      });
    } else {
      throw new Error('Invalid response from Cashfree API');
    }

  } catch (error) {
    console.error('❌ Failed to fetch payment details:', error);
    
    // Log specific Cashfree errors
    if (error.response) {
      console.error('Cashfree API Error Response:', error.response.data);
      console.error('Cashfree API Status:', error.response.status);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Verify payment status using Cashfree API
router.get('/verify-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Verifying payment for order: ${orderId}`);
    
    // Fetch payment details from Cashfree
    const response = await cashfree.PGOrderFetchPayments(orderId);
    console.log('💳 Cashfree payment details:', JSON.stringify(response.data, null, 2));
    
    // Find the purchase record
    const purchase = await Purchase.findOne({ 
      $or: [
        { orderId: orderId },
        { cashfreeOrderId: orderId }
      ]
    });
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Order not found in our records'
      });
    }
    
    // Update purchase with payment details from Cashfree
    if (response.data && response.data.length > 0) {
      const paymentData = response.data[0]; // Get the latest payment
      
      if (paymentData.payment_status === 'SUCCESS') {
        purchase.paymentStatus = 'completed';
        purchase.paymentCompletedAt = new Date();
        purchase.transactionId = paymentData.cf_payment_id;
        purchase.paymentMethod = paymentData.payment_method || 'unknown';
        
        await purchase.save();
        
        // Process the successful payment (register user, generate QR, send email)
        const result = await processSuccessfulPayment(purchase);
        
        if (result.success) {
          console.log(`✅ Payment verified and processed successfully for order: ${orderId}`);
        } else {
          console.error(`❌ Payment processing failed for order: ${orderId}, error: ${result.error}`);
        }
      } else {
        purchase.paymentStatus = 'failed';
        await purchase.save();
      }
    }
    
    res.json({
      success: true,
      data: {
        orderId: purchase.orderId,
        paymentStatus: purchase.paymentStatus,
        cashfreeData: response.data
      }
    });
    
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    // Log specific Cashfree errors
    if (error.response) {
      console.error('Cashfree API Error Response:', error.response.data);
      console.error('Cashfree API Status:', error.response.status);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Generate QR code for user
async function generateQRCode(userId, userData) {
  try {
    const qrDir = path.join(__dirname, '../public/qrcodes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrData = JSON.stringify({
      id: userId,
      name: userData.name,
      email: userData.email,
      timestamp: Date.now()
    });

    const qrFilename = `${userId}.png`;
    const qrPath = path.join(qrDir, qrFilename);
    const qrRelativePath = `/public/qrcodes/${qrFilename}`;

    return new Promise((resolve, reject) => {
      const qrPng = qr.image(qrData, { type: 'png', size: 10 });
      const writeStream = fs.createWriteStream(qrPath);
      
      qrPng.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log(`✅ QR code generated: ${qrRelativePath}`);
        resolve(qrRelativePath);
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

// Process successful payment
async function processSuccessfulPayment(purchase) {
  try {
    console.log(`🔄 Processing successful payment for order: ${purchase.orderId}`);
    
    const userData = purchase.userDetails;
    const eventNames = purchase.items.map(item => item.itemName);

    // Step 1: Register user in the system
    let user;
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      // Update existing user
      user = existingUser;
      user.name = userData.name;
      user.contactNo = userData.contactNo;
      user.gender = userData.gender;
      user.age = userData.age;
      user.universityName = userData.universityName;
      user.address = userData.address;
      user.events = [...new Set([...user.events, ...eventNames])];
      user.finalPrice = (user.finalPrice || 0) + purchase.totalAmount;
      user.isvalidated = true;
      user.extraDetails = userData.formData;
      user.rawRegistration = purchase.userDetails;
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
      
      user = new User({
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        contactNo: userData.contactNo,
        gender: userData.gender,
        age: userData.age,
        universityName: userData.universityName,
        address: userData.address,
        events: eventNames,
        finalPrice: purchase.totalAmount,
        isvalidated: true,
        extraDetails: userData.formData,
        rawRegistration: purchase.userDetails,
        teamMembers: userData.teamMembers || []
      });
    }

    await user.save();
    
    // Update purchase with user ID
    purchase.userId = user._id;
    purchase.userRegistered = true;

    // Step 2: Generate QR code
    try {
      const qrPath = await generateQRCode(user._id, userData);
      user.qrPath = qrPath;
      await user.save();
      
      purchase.qrGenerated = true;
      purchase.qrPath = qrPath;
    } catch (qrError) {
      console.error('QR generation failed, but continuing:', qrError);
      purchase.qrGenerated = false;
    }

    // Step 3: Process team members if any
    if (userData.teamMembers && userData.teamMembers.length > 0) {
      user.isMainPerson = true;
      user.teamId = `TEAM_${user._id}_${Date.now()}`;
      user.teamSize = userData.teamMembers.length + 1;
      await user.save();

      // Create team member records
      for (const memberData of userData.teamMembers) {
        try {
          const teamMember = new TeamMember({
            mainPersonId: user._id,
            name: memberData.name,
            email: memberData.email,
            contactNo: memberData.contactNo,
            gender: memberData.gender,
            age: memberData.age,
            universityName: memberData.universityName,
            address: memberData.address,
            events: eventNames,
            isvalidated: true,
            extraDetails: memberData
          });

          await teamMember.save();

          // Generate QR for team member
          try {
            const memberQrPath = await generateQRCode(teamMember._id, memberData);
            teamMember.qrPath = memberQrPath;
            await teamMember.save();
          } catch (memberQrError) {
            console.error(`QR generation failed for team member ${memberData.name}:`, memberQrError);
          }
        } catch (memberError) {
          console.error(`Failed to create team member ${memberData.name}:`, memberError);
        }
      }
    }

    // Step 4: Update promo code usage if applicable
    if (purchase.promoCode && purchase.promoCode.code) {
      try {
        await PromoCode.findOneAndUpdate(
          { code: purchase.promoCode.code },
          { 
            $inc: { usedCount: 1 },
            $push: {
              usedBy: {
                userId: user._id,
                usedAt: new Date(),
                orderAmount: purchase.subtotal,
                discountApplied: purchase.promoCode.discountAmount
              }
            }
          }
        );
      } catch (promoError) {
        console.error('Failed to update promo code usage:', promoError);
      }
    }

    // Step 5: Send registration email
    try {
      // Get QR code as base64 for email
      let qrCodeBase64 = null;
      if (user.qrPath) {
        try {
          const qrFilePath = path.join(__dirname, '..', user.qrPath);
          if (fs.existsSync(qrFilePath)) {
            const qrBuffer = fs.readFileSync(qrFilePath);
            qrCodeBase64 = qrBuffer.toString('base64');
          }
        } catch (qrReadError) {
          console.log('Could not read QR code for email');
        }
      }

      const emailData = {
        name: user.name,
        events: user.events,
        qrCodeBase64: qrCodeBase64
      };

      const emailResult = await sendRegistrationEmail(user.email, emailData);
      
      if (emailResult.success) {
        purchase.emailSent = true;
        purchase.emailSentAt = new Date();
        
        // Update user email status
        user.emailSent = true;
        user.emailSentAt = new Date();
        await user.save();
        
        console.log(`✅ Registration email sent to ${user.email}`);
      } else {
        console.error('Failed to send registration email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    await purchase.save();
    console.log(`✅ Payment processing completed for order: ${purchase.orderId}`);
    
    return { success: true, user: user };
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    purchase.registrationError = error.message;
    await purchase.save();
    return { success: false, error: error.message };
  }
}

// Webhook to handle payment status updates from Cashfree
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('📥 Received Cashfree webhook');
    
    const webhookData = JSON.parse(req.body.toString());
    console.log('Webhook data:', webhookData);
    
    const { order_id, order_status, payment_status } = webhookData.data || webhookData;

    if (!order_id) {
      console.error('No order_id in webhook data');
      return res.status(400).json({ message: 'Invalid webhook data' });
    }

    // Find the purchase record
    const purchase = await Purchase.findOne({ orderId: order_id });
    
    if (!purchase) {
      console.error(`Purchase not found for order: ${order_id}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log(`Processing webhook for order: ${order_id}, status: ${payment_status}`);

    // Update payment status based on webhook data
    if (payment_status === 'SUCCESS' && order_status === 'PAID') {
      purchase.paymentStatus = 'completed';
      purchase.paymentCompletedAt = new Date();
      purchase.transactionId = webhookData.data?.cf_payment_id || webhookData.cf_payment_id;
      purchase.paymentMethod = webhookData.data?.payment_method || 'unknown';
      
      await purchase.save();
      
      // Process the successful payment (register user, generate QR, send email)
      const result = await processSuccessfulPayment(purchase);
      
      if (result.success) {
        console.log(`✅ Payment webhook processed successfully for order: ${order_id}`);
      } else {
        console.error(`❌ Payment processing failed for order: ${order_id}, error: ${result.error}`);
      }
      
    } else if (payment_status === 'FAILED') {
      purchase.paymentStatus = 'failed';
      await purchase.save();
      console.log(`❌ Payment failed for order: ${order_id}`);
    } else {
      console.log(`ℹ️ Payment status update for order: ${order_id}, status: ${payment_status}`);
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Get payment status
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const purchase = await Purchase.findOne({ orderId: orderId })
      .populate('userId', 'name email qrPath events');

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
        paymentStatus: purchase.paymentStatus,
        totalAmount: purchase.totalAmount,
        items: purchase.items,
        transactionId: purchase.transactionId,
        userRegistered: purchase.userRegistered,
        qrGenerated: purchase.qrGenerated,
        emailSent: purchase.emailSent,
        user: purchase.userId ? {
          name: purchase.userId.name,
          email: purchase.userId.email,
          events: purchase.userId.events,
          qrPath: purchase.userId.qrPath
        } : null,
        paymentCompletedAt: purchase.paymentCompletedAt,
        emailSentAt: purchase.emailSentAt
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get payment status' 
    });
  }
});

// Manual payment processing endpoint (for admin use or testing)
router.post('/process-manual/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const purchase = await Purchase.findOne({ orderId: orderId });
    
    if (!purchase) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    if (purchase.paymentStatus === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already processed' 
      });
    }

    // Mark as completed and process
    purchase.paymentStatus = 'completed';
    purchase.paymentCompletedAt = new Date();
    purchase.transactionId = `MANUAL_${Date.now()}`;
    purchase.paymentMethod = 'manual';
    
    await purchase.save();
    
    const result = await processSuccessfulPayment(purchase);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Payment processed successfully',
        user: result.user
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Manual payment processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process payment' 
    });
  }
});

module.exports = router;