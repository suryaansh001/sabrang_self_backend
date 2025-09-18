const express = require('express');
const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { User, Purchase, TeamMember, PromoCode } = require('../models/models');
const { sendRegistrationEmail } = require('../utils/emailService');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const router = express.Router();

// Configure multer for file uploads (from direct_payment_new.js)
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

// Helper function to validate promo codes (from direct_payment_new.js)
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

// Test route
router.get('/', (req, res) => {
    res.json({ 
        message: 'Cashfree Simple Payment Gateway Ready!',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Validate promo code endpoint (from direct_payment_new.js)
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

            // Note: Email will be sent after successful payment verification
            // instead of sending it immediately when creating the order
            console.log('📧 Email will be sent after payment verification for:', customerEmail);

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

// Generate QR code for user using MongoDB ObjectID (Enhanced from direct_payment_new.js)
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

// Process successful payment - register user, generate QR, send email (Enhanced from direct_payment_new.js)
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
    purchase.mainPersonId = user._id;
    purchase.userRegistered = true;

    // Step 2: Generate QR code (if not already generated)
    if (!purchase.qrPath && !user.qrPath) {
      try {
        const qrResult = await generateQRCode(user._id, userData);
        user.qrPath = qrResult.qrPath;
        await user.save();
        
        purchase.qrGenerated = true;
        purchase.qrPath = qrResult.qrPath;
        console.log(`✅ QR code generated for user: ${user.email}`);
      } catch (qrError) {
        console.error('❌ QR code generation failed:', qrError);
        purchase.qrGenerated = false;
      }
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
          const hashedMemberPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
          
          const teamMember = new TeamMember({
            mainPersonId: user._id,
            name: memberData.name || 'Team Member',
            email: memberData.email || memberData.collegeMailId || `${(memberData.name || 'member')?.toLowerCase().replace(/\s+/g, '')}@team.local`,
            contactNo: memberData.contactNo || "",
            gender: memberData.gender || "",
            age: memberData.age ? Number(memberData.age) : null,
            universityName: memberData.universityName || user.universityName,
            address: memberData.address || user.address,
            events: user.events || []
          });

          await teamMember.save();

          // Generate QR code for team member
          try {
            const memberQrResult = await generateQRCode(teamMember._id, {
              name: teamMember.name,
              email: teamMember.email,
              orderId: purchase.orderId
            });
            teamMember.qrPath = memberQrResult.qrPath;
            await teamMember.save();
            console.log(`✅ QR code generated for team member: ${teamMember.email}`);
          } catch (memberQrError) {
            console.error(`❌ QR code generation failed for team member: ${teamMember.email}`, memberQrError);
          }
        } catch (memberError) {
          console.error('Failed to create team member:', memberError);
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
        console.log(`✅ Promo code usage updated: ${purchase.promoCode.code}`);
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
                        
                        // Process the successful payment (register user, generate QR, send email)
                        const result = await processSuccessfulPayment(purchase);
                        
                        if (result.success) {
                          console.log(`✅ Payment verified and processed successfully for order: ${orderId}`);
                        } else {
                          console.error(`❌ Payment processing failed for order: ${orderId}, error: ${result.error}`);
                        }
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
                    
                    // Process the successful payment (register user, generate QR, send email)
                    const result = await processSuccessfulPayment(purchase);
                    
                    if (result.success) {
                      console.log(`✅ Payment verified and processed successfully for order: ${orderId}`);
                    } else {
                      console.error(`❌ Payment processing failed for order: ${orderId}, error: ${result.error}`);
                    }
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
            // If still pending, try a live refresh from Cashfree once
            if (purchase.paymentStatus === 'pending') {
                try {
                    let orderResp = await cashfree.PGFetchOrder(orderId);
                    if (orderResp?.data?.order_status === 'PAID') {
                        purchase.paymentStatus = 'completed';
                        purchase.paymentCompletedAt = new Date();
                        await purchase.save();
                        
                        // Process the successful payment (register user, generate QR, send email)
                        const result = await processSuccessfulPayment(purchase);
                        
                        if (result.success) {
                          console.log(`✅ Payment verified and processed successfully for order: ${orderId}`);
                        } else {
                          console.error(`❌ Payment processing failed for order: ${orderId}, error: ${result.error}`);
                        }
                    }
                } catch (refreshErr) {
                    console.log('Non-fatal: status refresh failed:', refreshErr.message);
                }
            }

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
