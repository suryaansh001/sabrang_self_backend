const express = require('express');
const axios = require('axios');
const { Purchase, User, Event, TeamMember, PromoCode } = require('../models/models');
const { sendRegistrationEmail, sendTeamMemberEmail } = require('../utils/emailService');
const { generateUserQRCode } = require('../utils/qrCodeService');
const shortid = require('shortid');
const qr = require('qr-image');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Cashfree API configuration
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg';
const CASHFREE_API_VERSION = '2022-09-01';

console.log(`🔧 Cashfree Configuration:`);
console.log(`📡 Base URL: ${CASHFREE_BASE_URL}`);
console.log(`🔑 App ID: ${process.env.CASHFREE_APP_ID}`);
console.log(`� Secret: ${process.env.CASHFREE_SECRET_KEY ? 'SET' : 'NOT SET'}`);

// Helper function to make Cashfree API calls
async function makeCashfreeRequest(endpoint, method = 'POST', data = null) {
  const config = {
    method,
    url: `${CASHFREE_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': process.env.CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      'x-api-version': CASHFREE_API_VERSION
    }
  };

  if (data) {
    config.data = data;
  }

  return await axios(config);
}

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

    const validationResult = await validatePromoCode(code, userEmail, orderAmount);
    
    if (validationResult.success) {
      res.json({
        success: true,
        message: 'Promo code is valid',
        discountAmount: validationResult.discountAmount,
        finalAmount: validationResult.finalAmount
      });
    } else {
      res.status(200).json({
        success: false,
        message: validationResult.message
      });
    }

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create Cashfree order following the official documentation
router.post('/cashfree/create-order', upload.any(), async (req, res) => {
  try {
    console.log('🛒 Creating Cashfree order via new API endpoint');
    console.log('📝 Request body fields:', Object.keys(req.body));
    console.log('📁 Uploaded files:', req.files?.length || 0);

    // Parse form data and files from the frontend
    const formsBySignature = req.body.formsBySignature ? JSON.parse(req.body.formsBySignature) : {};
    const teamMembersBySignature = req.body.teamMembersBySignature ? JSON.parse(req.body.teamMembersBySignature) : {};
    const items = req.body.items ? JSON.parse(req.body.items) : [];
    const promoCode = req.body.promoCode;

    console.log('📋 Parsed data:', {
      formsCount: Object.keys(formsBySignature).length,
      teamsCount: Object.keys(teamMembersBySignature).length,
      itemsCount: items.length,
      hasPromo: !!promoCode
    });

    // Extract user details from the first form signature (main user)
    const firstSignature = Object.keys(formsBySignature)[0];
    const userDetails = formsBySignature[firstSignature] || {};

    // Validate required fields
    if (!userDetails.name || !userDetails.collegeMailId) {
      console.log('❌ Validation failed: Missing required user details');
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    if (!items || items.length === 0) {
      console.log('❌ Validation failed: No events selected');
      return res.status(400).json({ 
        success: false, 
        message: 'No events selected' 
      });
    }

    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => {
      const price = typeof item.price === 'string' ? 
        parseFloat(item.price.replace(/[₹,]/g, '')) || 0 : 
        item.price || 0;
      return sum + price;
    }, 0);

    if (totalAmount <= 0) {
      console.log('❌ Validation failed: Invalid total amount');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid total amount calculated' 
      });
    }

    console.log('✅ Input validation passed');

    // Generate unique order ID following Cashfree requirements (alphanumeric with _ and -)
    const orderId = `SABRANG_${shortid.generate()}_${Date.now()}`.substring(0, 50);
    console.log('🆔 Generated order ID:', orderId);

    // Apply promo code discount if provided
    let discountAmount = 0;
    let finalAmount = totalAmount;
    let promoCodeDetails = null;

    if (promoCode) {
      try {
        console.log('🎫 Validating promo code:', promoCode);
        const promoValidation = await validatePromoCode(promoCode, userDetails.collegeMailId, totalAmount);
        
        if (promoValidation.success) {
          discountAmount = promoValidation.discountAmount;
          finalAmount = Math.max(0, totalAmount - discountAmount);
          promoCodeDetails = {
            code: promoCode,
            discountAmount: discountAmount
          };
          console.log('✅ Promo code applied:', promoCodeDetails);
        } else {
          console.log('⚠️ Promo code validation failed:', promoValidation.message);
          // Continue without promo code rather than failing the entire order
        }
      } catch (promoError) {
        console.error('❌ Promo code validation error:', promoError);
        // Continue without promo code
      }
    }

    console.log('💰 Amount calculation:', { totalAmount, discountAmount, finalAmount });

    // Process uploaded files
    const uploadedFiles = {};
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Store file buffer and metadata for later processing
        uploadedFiles[file.fieldname] = {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        };
      }
    }

    // Extract team members data
    const teamMembersData = teamMembersBySignature[firstSignature] || [];

    // Create purchase record with detailed information
    const purchase = new Purchase({
      orderId: orderId,
      userId: null, // Will be set after user registration
      userDetails: {
        name: userDetails.name,
        email: userDetails.collegeMailId,
        contactNo: userDetails.contactNo || '',
        gender: userDetails.gender || '',
        age: userDetails.age ? parseInt(userDetails.age) : null,
        universityName: userDetails.universityName || '',
        address: userDetails.address || '',
        formData: formsBySignature,
        teamMembers: teamMembersData
      },
      items: items.map(item => ({
        type: 'event',
        itemId: item.id || item.eventId,
        itemName: item.title || item.eventName || item.name,
        price: typeof item.price === 'string' ? 
          parseFloat(item.price.replace(/[₹,]/g, '')) || 0 : 
          item.price || 0,
        quantity: 1
      })),
      subtotal: totalAmount,
      promoCode: promoCodeDetails,
      totalAmount: finalAmount,
      paymentStatus: 'pending',
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        source: 'checkout_new',
        filesUploaded: Object.keys(uploadedFiles).length,
        teamMembersCount: teamMembersData.length
      }
    });

    try {
      console.log('🔍 Attempting to save purchase with orderId:', purchase.orderId);
      await purchase.save();
      console.log('✅ Purchase record saved with ID:', purchase._id);
    } catch (error) {
      console.error('❌ Error saving purchase:', error);
      console.error('Purchase orderId:', purchase.orderId);
      console.error('Error details:', error.message);
      if (error.code === 11000) {
        console.error('❌ Duplicate orderId error - orderId already exists:', purchase.orderId);
      }
      throw error;
    }

    // Create Cashfree order request following the official documentation
    const createOrderRequest = {
      order_amount: finalAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: `customer_${Date.now()}`,
        customer_name: userDetails.name,
        customer_email: userDetails.collegeMailId,
        customer_phone: userDetails.contactNo || "9999999999"
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || process.env.frontendurl || 'http://localhost:3000'}/payment/success?order_id={order_id}`
      }
    };

    console.log('🔄 Creating Cashfree order with request:', JSON.stringify(createOrderRequest, null, 2));

    // Create order with Cashfree using direct API call
    const response = await makeCashfreeRequest('/orders', 'POST', createOrderRequest);
    console.log('📨 Cashfree API response status:', response.status);
    console.log('📨 Cashfree API response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.payment_session_id) {
      // Update purchase record with Cashfree response
      purchase.paymentSessionId = response.data.payment_session_id;
      purchase.cashfreeOrderId = response.data.order_id;
      
      // Store file information for later processing after payment success
      if (Object.keys(uploadedFiles).length > 0) {
        purchase.metadata.uploadedFiles = Object.keys(uploadedFiles);
        // Store files temporarily (in a real system, you'd want to use cloud storage)
        purchase.metadata.fileData = uploadedFiles;
      }
      
      await purchase.save();

      console.log('✅ Order created successfully:', {
        orderId,
        sessionId: response.data.payment_session_id,
        amount: finalAmount
      });

      // Return payment session details for frontend
      res.json({
        success: true,
        order_token: response.data.payment_session_id, // Frontend expects this field
        payment_session_id: response.data.payment_session_id,
        orderId: orderId,
        amount: finalAmount,
        cashfreeOrderId: response.data.order_id,
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
    } else {
      console.log('❌ Invalid Cashfree response structure:', response.data);
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

// Fetch order details from Cashfree
router.get('/fetch-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Fetching order details for: ${orderId}`);
    
    // Fetch order details from Cashfree using the official API
    const response = await cashfree.PGFetchOrder(CASHFREE_API_VERSION, orderId);
    
    if (response.data) {
      console.log('✅ Order details fetched successfully:', response.data);
      
      res.json({
        success: true,
        data: response.data
      });
    } else {
      throw new Error('Invalid response from Cashfree API');
    }

  } catch (error) {
    console.error('❌ Failed to fetch order details:', error);
    
    // Log specific Cashfree errors
    if (error.response) {
      console.error('Cashfree API Error Response:', error.response.data);
      console.error('Cashfree API Status:', error.response.status);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Fetch payment details from Cashfree
router.get('/fetch-payments/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Fetching payment details for order: ${orderId}`);
    
    // Fetch payment details from Cashfree using the official API
    const response = await cashfree.PGOrderFetchPayments(CASHFREE_API_VERSION, orderId);
    
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
    const response = await cashfree.PGOrderFetchPayments(CASHFREE_API_VERSION, orderId);
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

// Helper function to validate promo codes
async function validatePromoCode(code, userEmail, orderAmount) {
  try {
    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promoCode) {
      return { success: false, message: 'Invalid promo code' };
    }

    const currentDate = new Date();
    
    // Check validity period
    if (currentDate < promoCode.validFrom || currentDate > promoCode.validUntil) {
      return { success: false, message: 'Promo code has expired' };
    }

    // Check usage limit
    if (promoCode.usedCount >= promoCode.usageLimit) {
      return { success: false, message: 'Promo code usage limit exceeded' };
    }

    // Check minimum order amount
    if (orderAmount < promoCode.minOrderAmount) {
      return { success: false, message: `Minimum order amount is ₹${promoCode.minOrderAmount}` };
    }

    // Check email domain restriction
    if (promoCode.allowedEmailDomains.length > 0) {
      const userDomain = userEmail.split('@')[1];
      if (!promoCode.allowedEmailDomains.includes(userDomain)) {
        return { success: false, message: 'This promo code is not valid for your email domain' };
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

    return { 
      success: true, 
      discountAmount, 
      finalAmount: orderAmount - discountAmount 
    };

  } catch (error) {
    console.error('Promo code validation error:', error);
    return { success: false, message: 'Error validating promo code' };
  }
}

// Generate QR code for user as base64
async function generateQRCode(userId, userData) {
  try {
    console.log(`🔍 Generating QR code for user: ${userId}`);
    const qrCodeBase64 = await generateUserQRCode(userId, userData);
    console.log(`✅ QR code generated as base64 for user: ${userId}, length: ${qrCodeBase64 ? qrCodeBase64.length : 'null'}`);
    return qrCodeBase64;
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
    // Map purchase to main person as well
    purchase.mainPersonId = user._id;
    purchase.userRegistered = true;

    // Step 2: Generate QR code
    try {
      console.log(`🔍 Attempting QR generation for user ID: ${user._id} (type: ${typeof user._id})`);
      const qrCodeBase64 = await generateQRCode(user._id, userData);
      console.log(`🔍 Generated QR base64 length: ${qrCodeBase64 ? qrCodeBase64.length : 'null'}`);
      user.qrPath = `${user._id}`; // Keep for backward compatibility
      user.qrCodeBase64 = qrCodeBase64;
      
      purchase.qrGenerated = true;
      purchase.qrPath = `${user._id}`; // Keep for backward compatibility
      purchase.qrCodeBase64 = qrCodeBase64;
      console.log(`🔍 Set qrCodeBase64 on user and purchase`);
    } catch (qrError) {
      console.error('QR generation failed, but continuing:', qrError);
      console.error('User ID that failed:', user._id);
      console.error('User ID type:', typeof user._id);
      purchase.qrGenerated = false;
      // Set empty values to avoid undefined issues
      user.qrCodeBase64 = '';
      purchase.qrCodeBase64 = '';
    }

    // Step 3: Process team members if any
    if (userData.teamMembers && userData.teamMembers.length > 0) {
      user.isMainPerson = true;
      user.teamId = `TEAM_${user._id}_${Date.now()}`;
      user.teamSize = userData.teamMembers.length + 1;

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
            const memberQrCodeBase64 = await generateQRCode(teamMember._id, memberData);
            teamMember.qrPath = `${teamMember._id}`; // Keep for backward compatibility
            teamMember.qrCodeBase64 = memberQrCodeBase64;
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
          // Handle both production and development paths
          let qrFilePath;
          if (process.env.NODE_ENV === 'production' && user.qrPath.startsWith('/qrcodes/')) {
            // Production: direct path to volume
            qrFilePath = `/app${user.qrPath}`;
          } else if (user.qrPath.startsWith('/public/qrcodes/')) {
            // Development: relative to project root
            qrFilePath = path.join(__dirname, '..', user.qrPath);
          } else {
            // Fallback: try both paths
            const prodPath = `/app/qrcodes/${path.basename(user.qrPath)}`;
            const devPath = path.join(__dirname, '../public/qrcodes', path.basename(user.qrPath));
            qrFilePath = fs.existsSync(prodPath) ? prodPath : devPath;
          }
          
          if (fs.existsSync(qrFilePath)) {
            const qrBuffer = fs.readFileSync(qrFilePath);
            qrCodeBase64 = qrBuffer.toString('base64');
            console.log(`✅ QR code read for email from: ${qrFilePath}`);
          } else {
            console.log(`⚠️ QR code file not found at: ${qrFilePath}`);
          }
        } catch (qrReadError) {
          console.log('Could not read QR code for email:', qrReadError.message);
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

    // Step 6: Send emails to all team members if any
    // Check if user is a main person (has team members) and send emails
    if (user.isMainPerson && user.teamSize > 1) {
      try {
        // Get all team members for this user from database
        const teamMembers = await TeamMember.find({ mainPersonId: user._id });
        console.log(`📧 Found ${teamMembers.length} team members for user ${user.name}, sending emails...`);
        
        for (const member of teamMembers) {
          try {
            console.log(`📧 Processing team member: ${member.name} (${member.email})`);
            
            // Get QR code for team member
            let memberQrCodeBase64 = null;
            if (member.qrCodeBase64) {
              memberQrCodeBase64 = member.qrCodeBase64;
              console.log(`   ✅ Found QR code in database for ${member.name}`);
            } else if (member.qrPath) {
              try {
                const memberQrFilePath = path.join(__dirname, '../public/qrcodes', `${member._id}.png`);
                if (fs.existsSync(memberQrFilePath)) {
                  const qrBuffer = fs.readFileSync(memberQrFilePath);
                  memberQrCodeBase64 = qrBuffer.toString('base64');
                  console.log(`   ✅ Found QR code file for ${member.name}`);
                } else {
                  console.log(`   ⚠️ QR code file not found for ${member.name} at: ${memberQrFilePath}`);
                }
              } catch (qrReadError) {
                console.log(`   ❌ Could not read QR code for team member ${member.name}:`, qrReadError.message);
              }
            } else {
              console.log(`   ⚠️ No QR code data found for ${member.name}`);
            }

            const memberEmailData = {
              name: member.name,
              email: member.email,
              contactNo: member.contactNo,
              gender: member.gender,
              age: member.age,
              universityName: member.universityName,
              address: member.address,
              events: member.events || eventNames,
              qrCodeBase64: memberQrCodeBase64,
              teamLeader: user.name // Add team leader info
            };

            console.log(`   📤 Sending email to ${member.email}...`);
            const memberEmailResult = await sendTeamMemberEmail(member.email, memberEmailData);
            
            if (memberEmailResult.success) {
              member.emailSent = true;
              member.emailSentAt = new Date();
              member.emailSentBy = user._id;
              await member.save();
              console.log(`   ✅ Registration email sent successfully to team member ${member.name} (${member.email})`);
            } else {
              console.error(`   ❌ Failed to send email to team member ${member.name}:`, memberEmailResult.error);
            }
            
            // Add small delay to avoid overwhelming the email service
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (memberEmailError) {
            console.error(`   ❌ Error sending email to team member ${member.name}:`, memberEmailError);
          }
        }
        
        console.log(`📧 Completed sending emails to team members`);
      } catch (teamEmailError) {
        console.error('Error processing team member emails:', teamEmailError);
      }
    }

    // Save user with all updates
    console.log(`🔍 Saving user with qrCodeBase64: ${user.qrCodeBase64 ? 'present' : 'missing'}`);
    await user.save();
    console.log(`🔍 User saved successfully`);
    
    console.log(`🔍 Saving purchase with qrCodeBase64: ${purchase.qrCodeBase64 ? 'present' : 'missing'}`);
    await purchase.save();
    console.log(`🔍 Purchase saved successfully`);
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
      .populate('userId', 'name email qrPath events')
      .populate('mainPersonId', 'name email qrPath events');

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
        mainPerson: purchase.mainPersonId ? {
          name: purchase.mainPersonId.name,
          email: purchase.mainPersonId.email,
          events: purchase.mainPersonId.events,
          qrPath: purchase.mainPersonId.qrPath
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
