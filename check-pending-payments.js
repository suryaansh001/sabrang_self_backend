/**
 * Enhanced Cashfree Order Status Validation Script
 * Based on official Cashfree API documentation
 */

const mongoose = require('mongoose');
const { Purchase, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');

// Import Cashfree configuration
const { Cashfree } = require('cashfree-pg');

// Cashfree Order Status Constants
const ORDER_STATUS = {
    ACTIVE: 'ACTIVE',           // No successful transaction yet
    PAID: 'PAID',               // Order paid successfully
    EXPIRED: 'EXPIRED',         // Order expired without payment
    TERMINATED: 'TERMINATED',   // Order terminated
    TERMINATION_REQUESTED: 'TERMINATION_REQUESTED'
};

// Payment Status Constants
const PAYMENT_STATUS = {
    SUCCESS: 'SUCCESS',
    PENDING: 'PENDING',
    USER_DROPPED: 'USER_DROPPED',
    FAILED: 'FAILED',
    VOID: 'VOID',
    CANCELLED: 'CANCELLED'
};

async function getAllPendingOrders() {
    try {
        console.log('🔍 Fetching all pending orders from database...');
        
        const pendingOrders = await Purchase.find({
            $or: [
                { paymentStatus: { $in: ['pending', 'initiated', 'active'] } },
                { paymentStatus: { $exists: false } },
                { userRegistered: { $ne: true } },
                { qrGenerated: { $ne: true } },
                { emailSent: { $ne: true } }
            ]
        }).populate('userId', 'name email contactNo')
          .populate('mainPersonId', 'name email contactNo')
          .sort({ createdAt: -1 });
        
        console.log(`📊 Found ${pendingOrders.length} orders that need checking`);
        
        if (pendingOrders.length === 0) {
            console.log('✅ No pending orders found');
            return [];
        }
        
        console.log('\n📋 Pending Orders Summary:');
        pendingOrders.forEach((purchase, index) => {
            const user = purchase.userId || purchase.mainPersonId;
            const userDetails = purchase.userDetails;
            console.log(`\n   ${index + 1}. Order: ${purchase.orderId || purchase.cashfreeOrderId}`);
            console.log(`      Status: ${purchase.paymentStatus || 'pending'}`);
            console.log(`      Amount: ₹${purchase.totalAmount}`);
            console.log(`      Customer: ${user?.name || userDetails?.name || 'Unknown'}`);
            console.log(`      Email: ${user?.email || userDetails?.email || 'Unknown'}`);
            console.log(`      User Registered: ${purchase.userRegistered ? '✅' : '❌'}`);
            console.log(`      QR Generated: ${purchase.qrGenerated ? '✅' : '❌'}`);
            console.log(`      Email Sent: ${purchase.emailSent ? '✅' : '❌'}`);
        });
        
        return pendingOrders;
        
    } catch (error) {
        console.error('❌ Error fetching pending orders:', error);
        return [];
    }
}

async function checkSingleOrderInDatabase(orderId) {
    try {
        console.log(`🔍 Checking order ${orderId} in database...`);
        
        const purchase = await Purchase.findOne({ 
            $or: [
                { orderId: orderId },
                { cashfreeOrderId: orderId }
            ]
        }).populate('userId', 'name email contactNo')
          .populate('mainPersonId', 'name email contactNo');
        
        if (!purchase) {
            console.log('❌ Order not found in database');
            return null;
        }
        
        console.log('📋 Current order details:');
        console.log(`   Order ID: ${purchase.orderId}`);
        console.log(`   Cashfree Order ID: ${purchase.cashfreeOrderId || 'Not set'}`);
        console.log(`   Payment Session ID: ${purchase.paymentSessionId || 'Not set'}`);
        console.log(`   Current Status: ${purchase.paymentStatus || 'pending'}`);
        console.log(`   Total Amount: ₹${purchase.totalAmount}`);
        
        const user = purchase.userId || purchase.mainPersonId;
        const userDetails = purchase.userDetails;
        console.log(`   Customer: ${user?.name || userDetails?.name || 'Unknown'}`);
        console.log(`   Email: ${user?.email || userDetails?.email || 'Unknown'}`);
        
        console.log(`   User Registered: ${purchase.userRegistered ? '✅' : '❌'}`);
        console.log(`   QR Generated: ${purchase.qrGenerated ? '✅' : '❌'}`);
        console.log(`   Email Sent: ${purchase.emailSent ? '✅' : '❌'}`);
        
        return purchase;
        
    } catch (error) {
        console.error('❌ Error checking order in database:', error);
        return null;
    }
}

async function processSuccessfulPayment(purchase, cashfreeStatus) {
    try {
        console.log('\n✅ Processing successful payment...');
        
        // Update purchase status
        purchase.paymentStatus = 'completed';
        purchase.paymentCompletedAt = new Date();
        
        // Update payment details from Cashfree
        if (cashfreeStatus.payments && cashfreeStatus.payments.length > 0) {
            const payment = cashfreeStatus.payments[0];
            purchase.paymentMethod = payment.payment_method;
            purchase.transactionId = payment.cf_payment_id;
        }
        
        // Find or create user
        let user = purchase.userId || purchase.mainPersonId;
        if (!user) {
            console.log('👤 Creating new user from purchase details...');
            const userData = purchase.userDetails;
            
            // Check if user already exists by email
            user = await User.findOne({ email: userData.email.toLowerCase().trim() });
            
            if (!user) {
                // Create new user
                const hashedPassword = await require('bcrypt').hash('defaultPassword123', 12);
                
                user = new User({
                    name: userData.name,
                    email: userData.email.toLowerCase().trim(),
                    contactNo: userData.contactNo || '',
                    password: hashedPassword,
                    gender: userData.gender || '',
                    age: userData.age || null,
                    universityName: userData.universityName || '',
                    address: userData.address || '',
                    referralCode: userData.referralCode || '',
                    events: purchase.items?.map(item => item.itemName).filter(Boolean) || [],
                    userType: 'participant',
                    isvalidated: true,
                    hasEntered: false,
                    emailSent: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                
                await user.save();
                console.log(`✅ New user created: ${user.name} (${user.email})`);
            } else {
                // Update existing user events
                const newEvents = purchase.items?.map(item => item.itemName).filter(Boolean) || [];
                newEvents.forEach(event => {
                    if (!user.events.includes(event)) {
                        user.events.push(event);
                    }
                });
                user.isvalidated = true;
                await user.save();
                console.log(`✅ Updated existing user: ${user.name} (${user.email})`);
            }
            
            // Link purchase to user
            purchase.userId = user._id;
            purchase.mainPersonId = user._id;
        }
        
        // Generate QR code if not exists
        if (!user.qrCodeBase64 && !user.qrPath) {
            console.log('🔄 Generating QR code...');
            try {
                const qrCodeBase64 = await generateUserQRCode(user._id, {
                    name: user.name,
                    email: user.email,
                    events: user.events,
                    userId: user._id
                });
                
                if (qrCodeBase64) {
                    user.qrPath = `qr_${user._id}.png`;
                    user.qrCodeBase64 = qrCodeBase64;
                    console.log('✅ QR code generated successfully');
                } else {
                    console.log('⚠️ QR code generation failed');
                }
            } catch (qrError) {
                console.log('⚠️ QR code generation error:', qrError.message);
            }
        } else {
            console.log('✅ User already has QR code');
        }
        
        // Save user
        await user.save();
        
        // Update purchase flags
        purchase.userRegistered = true;
        purchase.qrGenerated = !!(user.qrPath || user.qrCodeBase64);
        
        // Send email if not sent
        if (!purchase.emailSent && !user.emailSent) {
            console.log('📧 Sending registration email...');
            
            try {
                const emailData = {
                    name: user.name,
                    events: user.events,
                    qrCodeBase64: user.qrCodeBase64
                };
                
                const emailResult = await sendRegistrationEmail(user.email, emailData);
                
                if (emailResult.success) {
                    purchase.emailSent = true;
                    purchase.emailSentAt = new Date();
                    user.emailSent = true;
                    user.emailSentAt = new Date();
                    console.log('✅ Registration email sent successfully');
                } else {
                    console.log('⚠️ Email sending failed:', emailResult.error);
                }
            } catch (emailError) {
                console.log('⚠️ Email sending error:', emailError.message);
            }
        } else {
            console.log('📧 Email was already sent');
        }
        
        // Save final updates
        await user.save();
        await purchase.save();
        
        console.log('\n🎉 Order processing completed successfully!');
        console.log('📊 Final status:');
        console.log(`   Payment Status: ${purchase.paymentStatus}`);
        console.log(`   User Registered: ${purchase.userRegistered ? '✅' : '❌'}`);
        console.log(`   QR Generated: ${purchase.qrGenerated ? '✅' : '❌'}`);
        console.log(`   Email Sent: ${purchase.emailSent ? '✅' : '❌'}`);
        
        return { success: true, user, purchase };
        
    } catch (error) {
        console.error('❌ Error processing successful payment:', error);
        return { success: false, error: error.message };
    }
}

async function initializeCashfree() {
    try {
        // Check if Environment property exists (newer SDK versions)
        if (Cashfree.Environment) {
            // Method 1: Using static properties (newer SDK)
            Cashfree.XClientId = process.env.CASHFREE_PROD_CLIENT_ID;
            Cashfree.XClientSecret = process.env.CASHFREE_PROD_CLIENT_SECRET;
            Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;
            console.log('✅ Cashfree initialized (static properties method)');
        } else if (Cashfree.PRODUCTION) {
            // Method 2: Using constructor (older SDK or alternative method)
            // Note: This creates an instance but we'll use static methods
            Cashfree.XClientId = process.env.CASHFREE_PROD_CLIENT_ID;
            Cashfree.XClientSecret = process.env.CASHFREE_PROD_CLIENT_SECRET;
            Cashfree.XEnvironment = Cashfree.PRODUCTION;
            console.log('✅ Cashfree initialized (PRODUCTION constant)');
        } else {
            // Fallback: Just set credentials without environment
            Cashfree.XClientId = process.env.CASHFREE_PROD_CLIENT_ID;
            Cashfree.XClientSecret = process.env.CASHFREE_PROD_CLIENT_SECRET;
            console.log('✅ Cashfree initialized (credentials only)');
            console.log('⚠️ Environment setting not available in this SDK version');
        }
        
        console.log('🌍 Environment: PRODUCTION');
        return true;
    } catch (error) {
        console.error('❌ Cashfree initialization failed:', error);
        console.error('Error details:', error.message);
        console.error('SDK version issue - check your cashfree-pg package version');
        return false;
    }
}

async function getOrderStatusFromCashfree(orderIdToCheck) {
    try {
        console.log(`🔄 Fetching order status from Cashfree for: ${orderIdToCheck}`);
        
        // Use the correct API version (format: YYYY-MM-DD)
        const apiVersion = '2023-08-01';
        
        // Call PGFetchOrder with API version and order ID
        const response = await Cashfree.PGFetchOrder(apiVersion, orderIdToCheck);
        
        if (response && response.data) {
            const orderData = response.data;
            console.log('📊 Cashfree order status:');
            console.log(`   Order ID: ${orderData.order_id}`);
            console.log(`   Order Status: ${orderData.order_status}`);
            console.log(`   Amount: ₹${orderData.order_amount}`);
            console.log(`   Currency: ${orderData.order_currency}`);
            console.log(`   Created: ${orderData.created_at}`);
            console.log(`   Order Expiry: ${orderData.order_expiry_time || 'N/A'}`);
            
            // Enhanced payment details logging
            if (orderData.payments && orderData.payments.length > 0) {
                console.log(`💳 Found ${orderData.payments.length} payment(s):`);
                
                orderData.payments.forEach((payment, index) => {
                    console.log(`   Payment ${index + 1}:`);
                    console.log(`      Payment Status: ${payment.payment_status}`);
                    console.log(`      Payment Method: ${payment.payment_method || 'N/A'}`);
                    console.log(`      CF Payment ID: ${payment.cf_payment_id}`);
                    console.log(`      Payment Amount: ₹${payment.payment_amount || 'N/A'}`);
                    console.log(`      Payment Time: ${payment.payment_completion_time || 'Pending'}`);
                    console.log(`      Bank Reference: ${payment.bank_reference || 'N/A'}`);
                });
            } else {
                console.log('💳 No payment attempts found');
            }
            
            return orderData;
        } else {
            console.log('❌ No data received from Cashfree');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error fetching from Cashfree:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

function validateOrderStatus(cashfreeStatus, dbPurchase) {
    const validation = {
        isValid: false,
        shouldUpdate: false,
        orderStatus: null,
        paymentStatus: null,
        canProcess: false,
        messages: []
    };
    
    if (!cashfreeStatus) {
        validation.messages.push('❌ No Cashfree status data available');
        return validation;
    }
    
    validation.orderStatus = cashfreeStatus.order_status;
    validation.isValid = true;
    
    // Check order status
    switch (cashfreeStatus.order_status) {
        case ORDER_STATUS.PAID:
            validation.messages.push('✅ Order is PAID in Cashfree');
            validation.canProcess = true;
            
            // Check if we need to update database
            if (dbPurchase.paymentStatus?.toLowerCase() !== 'completed') {
                validation.shouldUpdate = true;
                validation.messages.push('🔄 Database needs update - marking as completed');
            } else {
                validation.messages.push('ℹ️ Database already updated - no action needed');
            }
            
            // Validate payment details
            if (cashfreeStatus.payments && cashfreeStatus.payments.length > 0) {
                const successfulPayment = cashfreeStatus.payments.find(
                    p => p.payment_status === PAYMENT_STATUS.SUCCESS
                );
                
                if (successfulPayment) {
                    validation.paymentStatus = successfulPayment.payment_status;
                    validation.messages.push(`✅ Found successful payment: ${successfulPayment.cf_payment_id}`);
                } else {
                    validation.messages.push('⚠️ Order is PAID but no SUCCESS payment found');
                }
            }
            break;
            
        case ORDER_STATUS.ACTIVE:
            validation.messages.push('⏳ Order is ACTIVE - payment not completed yet');
            validation.messages.push('ℹ️ Customer may still be completing payment');
            break;
            
        case ORDER_STATUS.EXPIRED:
            validation.messages.push('⏰ Order has EXPIRED');
            validation.messages.push('⚠️ No payment can be processed for this order');
            
            // Check if payment was attempted before expiry
            if (cashfreeStatus.payments && cashfreeStatus.payments.length > 0) {
                validation.messages.push('ℹ️ Payment was attempted but not successful');
            }
            break;
            
        case ORDER_STATUS.TERMINATED:
        case ORDER_STATUS.TERMINATION_REQUESTED:
            validation.messages.push(`🚫 Order is ${cashfreeStatus.order_status}`);
            validation.messages.push('⚠️ Cannot process this order');
            break;
            
        default:
            validation.messages.push(`⚠️ Unknown order status: ${cashfreeStatus.order_status}`);
    }
    
    // Additional validations
    if (cashfreeStatus.order_amount !== dbPurchase.totalAmount) {
        validation.messages.push(
            `⚠️ Amount mismatch - Cashfree: ₹${cashfreeStatus.order_amount}, DB: ₹${dbPurchase.totalAmount}`
        );
    }
    
    return validation;
}

async function processAllPendingOrders() {
    try {
        console.log('🚀 Starting bulk order status update process...');
        
        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');
        
        // Initialize Cashfree
        const cashfreeInitialized = await initializeCashfree();
        if (!cashfreeInitialized) {
            throw new Error('Failed to initialize Cashfree');
        }
        
        // Get all pending orders
        const pendingOrders = await getAllPendingOrders();
        
        if (pendingOrders.length === 0) {
            console.log('✅ No pending orders to process');
            return;
        }
        
        console.log(`\n🔄 Processing ${pendingOrders.length} orders...`);
        console.log('='.repeat(80));
        
        const results = {
            processed: 0,
            updated: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
        
        // Process each order
        for (let i = 0; i < pendingOrders.length; i++) {
            const purchase = pendingOrders[i];
            const orderNumber = i + 1;
            
            try {
                console.log(`\n[${orderNumber}/${pendingOrders.length}] Processing Order: ${purchase.orderId || purchase.cashfreeOrderId}`);
                console.log('-'.repeat(60));
                
                // Determine which order ID to use for Cashfree API
                const cashfreeOrderId = purchase.cashfreeOrderId || purchase.orderId;
                
                if (!cashfreeOrderId) {
                    console.log('⚠️ No valid order ID found - skipping');
                    results.skipped++;
                    continue;
                }
                
                console.log(`🔍 Using order ID for Cashfree API: ${cashfreeOrderId}`);
                
                // Get status from Cashfree
                const cashfreeStatus = await getOrderStatusFromCashfree(cashfreeOrderId);
                
                if (!cashfreeStatus) {
                    console.log('❌ Could not fetch status from Cashfree - skipping');
                    results.failed++;
                    results.errors.push(`${cashfreeOrderId}: Failed to fetch from Cashfree`);
                    continue;
                }
                
                // Validate the order status
                console.log('📋 Validating Order Status...');
                const validation = validateOrderStatus(cashfreeStatus, purchase);
                
                // Display validation results
                validation.messages.forEach(msg => console.log(msg));
                
                results.processed++;
                
                // Process based on validation
                if (validation.canProcess && validation.shouldUpdate) {
                    console.log('🔄 Processing payment update...');
                    const result = await processSuccessfulPayment(purchase, cashfreeStatus);
                    
                    if (result.success) {
                        console.log('✅ Order status updated successfully!');
                        console.log(`👤 User: ${result.user.name} (${result.user.email})`);
                        console.log(`🎫 Events: ${result.user.events.join(', ')}`);
                        results.updated++;
                    } else {
                        console.log('❌ Failed to process payment:', result.error);
                        results.failed++;
                        results.errors.push(`${cashfreeOrderId}: ${result.error}`);
                    }
                } else if (validation.canProcess && !validation.shouldUpdate) {
                    console.log('✅ No action needed - order already processed');
                    results.skipped++;
                } else {
                    console.log('⚠️ Cannot process order - check status above');
                    results.skipped++;
                }
                
                // Add delay between API calls to avoid rate limiting
                if (i < pendingOrders.length - 1) {
                    console.log('⏳ Waiting 2 seconds before next order...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (orderError) {
                console.error(`❌ Error processing order ${purchase.orderId || purchase.cashfreeOrderId}:`, orderError.message);
                results.failed++;
                results.errors.push(`${purchase.orderId || purchase.cashfreeOrderId}: ${orderError.message}`);
            }
        }
        
        // Final summary
        console.log('\n🎉 BULK PROCESSING COMPLETED');
        console.log('='.repeat(80));
        console.log(`📊 Processing Summary:`);
        console.log(`   Total Orders Found: ${pendingOrders.length}`);
        console.log(`   Orders Processed: ${results.processed}`);
        console.log(`   Orders Updated: ${results.updated}`);
        console.log(`   Orders Skipped: ${results.skipped}`);
        console.log(`   Orders Failed: ${results.failed}`);
        
        if (results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        console.log(`\n📅 Completed at: ${new Date().toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Bulk processing failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        try {
            await mongoose.disconnect();
            console.log('\n📴 Disconnected from MongoDB');
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError);
        }
    }
}

// Load environment variables
require('dotenv').config();

// Validate environment variables
const requiredEnvVars = ['CASHFREE_PROD_CLIENT_ID', 'CASHFREE_PROD_CLIENT_SECRET', 'mongodb'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
}

// Run the script
console.log('🔄 BULK ORDER STATUS UPDATE SCRIPT');
console.log('===================================');
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log('🎯 Target: ALL PENDING ORDERS');
console.log('⚠️ This will check Cashfree status for all pending orders and update database accordingly\n');

processAllPendingOrders();