#!/usr/bin/env node

/**
 * Pending Payment Status Checker and QR Generator
 * 
 * This script:
 * 1. Finds orders that were pending but have been paid on Cashfree
 * 2. Updates payment status and processes successful payments
 * 3. Generates QR codes for users who completed payment but don't have QR codes
 * 4. Sends confirmation emails
 */

const mongoose = require('mongoose');
const { Cashfree } = require('cashfree-pg');
const { Purchase, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Initialize Cashfree
const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
const clientId = process.env.NODE_ENV === 'production' ? process.env.CASHFREE_PROD_CLIENT_ID : process.env.CASHFREE_CLIENT_ID;
const clientSecret = process.env.NODE_ENV === 'production' ? process.env.CASHFREE_PROD_CLIENT_SECRET : process.env.CASHFREE_CLIENT_SECRET;

Cashfree.XClientId = clientId;
Cashfree.XClientSecret = clientSecret;
Cashfree.XEnvironment = Cashfree.Environment[environment];

async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function checkCashfreePaymentStatus(orderId) {
    try {
        console.log(`🔍 Checking Cashfree status for order: ${orderId}`);
        
        // Cashfree API call to get payment status
        const response = await Cashfree.PGOrderFetchPayments(orderId);
        
        if (response && response.data && response.data.length > 0) {
            const payment = response.data[0];
            console.log(`   Cashfree status: ${payment.payment_status}`);
            console.log(`   Payment method: ${payment.payment_method || 'N/A'}`);
            console.log(`   Amount: ${payment.payment_amount || 'N/A'}`);
            
            return {
                status: payment.payment_status,
                method: payment.payment_method,
                amount: payment.payment_amount,
                transactionId: payment.cf_payment_id,
                completedAt: payment.payment_time
            };
        } else {
            console.log(`   No payment data found for order: ${orderId}`);
            return null;
        }
    } catch (error) {
        console.error(`   ❌ Error checking Cashfree status for ${orderId}:`, error.message);
        return null;
    }
}

async function processSuccessfulPayment(purchase, cashfreeStatus) {
    try {
        console.log(`🎉 Processing successful payment for ${purchase.orderId}`);
        
        // Update purchase record
        purchase.paymentStatus = 'completed';
        purchase.status = 'PAID';
        purchase.paymentCompletedAt = new Date(cashfreeStatus.completedAt) || new Date();
        purchase.transactionId = cashfreeStatus.transactionId;
        purchase.paymentMethod = cashfreeStatus.method;
        
        // Find or create user
        const userEmail = purchase.userDetails?.email || purchase.customerDetails?.email;
        if (!userEmail) {
            throw new Error('No user email found in purchase record');
        }
        
        let user = await User.findOne({ email: userEmail });
        
        if (!user) {
            console.log(`   Creating new user for: ${userEmail}`);
            // Create user from purchase data
            const userData = purchase.userDetails || purchase.customerDetails;
            const eventNames = purchase.items?.map(item => item.itemName || item.title).filter(Boolean) || [];
            
            user = new User({
                name: userData.name,
                email: userEmail,
                password: '$2b$12$default.hash', // Placeholder password
                contactNo: userData.contactNo || userData.phone || '',
                gender: userData.gender || '',
                age: userData.age || null,
                universityName: userData.universityName || '',
                address: userData.address || '',
                events: eventNames,
                isvalidated: true,
                userType: 'participant',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            console.log(`   Updating existing user: ${userEmail}`);
            // Update user with new events if needed
            const eventNames = purchase.items?.map(item => item.itemName || item.title).filter(Boolean) || [];
            const newEvents = eventNames.filter(event => !user.events.includes(event));
            if (newEvents.length > 0) {
                user.events.push(...newEvents);
                console.log(`   Added new events: ${newEvents.join(', ')}`);
            }
            user.isvalidated = true;
            user.updatedAt = new Date();
        }
        
        // Generate QR code if not exists
        if (!user.qrPath && !user.qrCodeBase64) {
            console.log(`   🏗️ Generating QR code for user: ${user.email}`);
            
            try {
                const qrCodeBase64 = await generateUserQRCode(user._id, {
                    name: user.name,
                    email: user.email,
                    events: user.events,
                    userId: user._id
                });
                
                if (qrCodeBase64) {
                    user.qrCodeBase64 = qrCodeBase64;
                    user.qrPath = `qr_${user._id}.png`; // Set a virtual path
                    console.log(`   ✅ QR code generated successfully`);
                } else {
                    console.log(`   ⚠️ QR code generation failed: No QR code returned`);
                }
            } catch (qrError) {
                console.log(`   ⚠️ QR code generation error: ${qrError.message}`);
            }
        } else {
            console.log(`   ✅ User already has QR code: ${user.qrPath || 'base64 format'}`);
        }
        
        // Save user
        await user.save();
        console.log(`   💾 User saved successfully`);
        
        // Update purchase flags
        purchase.userRegistered = true;
        purchase.qrGenerated = !!(user.qrPath || user.qrCodeBase64);
        
        // Send email if not sent
        if (!purchase.emailSent && !user.emailSent) {
            console.log(`   📧 Sending registration email to: ${user.email}`);
            
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
                    await user.save();
                    console.log(`   ✅ Email sent successfully`);
                } else {
                    console.log(`   ⚠️ Email sending failed: ${emailResult.error}`);
                }
            } catch (emailError) {
                console.log(`   ⚠️ Email sending error: ${emailError.message}`);
            }
        } else {
            console.log(`   📧 Email already sent previously`);
        }
        
        // Save purchase
        await purchase.save();
        console.log(`   💾 Purchase updated successfully`);
        
        return {
            success: true,
            user: user,
            purchase: purchase
        };
        
    } catch (error) {
        console.error(`❌ Error processing successful payment:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function checkPendingPayments() {
    console.log('🔍 Checking for pending payments that may have been completed...\n');
    
    try {
        // Find all purchases with pending status
        const pendingPurchases = await Purchase.find({
            $or: [
                { paymentStatus: 'pending' },
                { status: 'ACTIVE' },
                { status: 'CREATED' }
            ]
        }).sort({ createdAt: -1 });
        
        console.log(`📋 Found ${pendingPurchases.length} pending purchases to check\n`);
        
        if (pendingPurchases.length === 0) {
            console.log('✅ No pending purchases found.');
            return;
        }
        
        let updatedCount = 0;
        let failedCount = 0;
        
        for (const purchase of pendingPurchases) {
            console.log(`\n📦 Checking purchase: ${purchase.orderId}`);
            console.log(`   Email: ${purchase.userDetails?.email || purchase.customerDetails?.email || 'N/A'}`);
            console.log(`   Amount: ${purchase.amount || purchase.totalAmount || 'N/A'}`);
            console.log(`   Created: ${purchase.createdAt || purchase.purchaseDate || 'N/A'}`);
            console.log(`   Current Status: ${purchase.paymentStatus || purchase.status}`);
            
            // Check Cashfree status
            const cashfreeStatus = await checkCashfreePaymentStatus(purchase.orderId);
            
            if (cashfreeStatus && cashfreeStatus.status === 'SUCCESS') {
                console.log(`   🎉 Payment SUCCESS found on Cashfree!`);
                
                // Process the successful payment
                const result = await processSuccessfulPayment(purchase, cashfreeStatus);
                
                if (result.success) {
                    console.log(`   ✅ Successfully processed payment for: ${result.user.email}`);
                    console.log(`   📱 QR Code: ${result.user.qrPath ? 'Generated' : 'Not generated'}`);
                    console.log(`   📧 Email: ${result.purchase.emailSent ? 'Sent' : 'Not sent'}`);
                    updatedCount++;
                } else {
                    console.log(`   ❌ Failed to process payment: ${result.error}`);
                    failedCount++;
                }
            } else if (cashfreeStatus && cashfreeStatus.status === 'FAILED') {
                console.log(`   ❌ Payment FAILED on Cashfree`);
                // Update purchase to failed status
                purchase.paymentStatus = 'failed';
                purchase.status = 'FAILED';
                await purchase.save();
            } else if (cashfreeStatus) {
                console.log(`   ⏳ Payment still ${cashfreeStatus.status} on Cashfree`);
            } else {
                console.log(`   ⚠️ Could not verify payment status on Cashfree`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n=====================================');
        console.log('📊 SUMMARY:');
        console.log(`   Total checked: ${pendingPurchases.length}`);
        console.log(`   Successfully updated: ${updatedCount}`);
        console.log(`   Failed to update: ${failedCount}`);
        console.log(`   Still pending: ${pendingPurchases.length - updatedCount - failedCount}`);
        
        if (updatedCount > 0) {
            console.log('\n🎉 GREAT! Some pending payments have been successfully processed!');
            console.log('   Users should now be able to access their QR codes.');
        }
        
    } catch (error) {
        console.error('❌ Error checking pending payments:', error);
    }
}

async function checkSpecificUser(email) {
    console.log(`\n🔍 Checking specific user: ${email}`);
    
    try {
        const user = await User.findOne({ email: email });
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return;
        }
        
        console.log(`✅ User found: ${user.name}`);
        console.log(`   Events: ${user.events.join(', ')}`);
        console.log(`   Validated: ${user.isvalidated}`);
        console.log(`   QR Path: ${user.qrPath || 'Not generated'}`);
        console.log(`   Email Sent: ${user.emailSent || false}`);
        
        // Find related purchases
        const purchases = await Purchase.find({
            $or: [
                { 'userDetails.email': email },
                { 'customerDetails.email': email }
            ]
        }).sort({ createdAt: -1 });
        
        console.log(`\n📦 Found ${purchases.length} related purchases:`);
        
        for (const purchase of purchases) {
            console.log(`\n   Order: ${purchase.orderId}`);
            console.log(`   Status: ${purchase.paymentStatus || purchase.status}`);
            console.log(`   Amount: ${purchase.amount || purchase.totalAmount}`);
            console.log(`   Items: ${purchase.items?.map(i => i.itemName || i.title).join(', ') || 'N/A'}`);
            
            // Check Cashfree status for this order
            const cashfreeStatus = await checkCashfreePaymentStatus(purchase.orderId);
            if (cashfreeStatus) {
                console.log(`   Cashfree Status: ${cashfreeStatus.status}`);
                
                if (cashfreeStatus.status === 'SUCCESS' && purchase.paymentStatus !== 'completed') {
                    console.log(`   🎉 Found successful payment that needs processing!`);
                    const result = await processSuccessfulPayment(purchase, cashfreeStatus);
                    if (result.success) {
                        console.log(`   ✅ Successfully processed payment`);
                    } else {
                        console.log(`   ❌ Failed to process: ${result.error}`);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ Error checking user ${email}:`, error);
    }
}

async function main() {
    console.log('🚀 Pending Payment Status Checker & QR Generator');
    console.log('==================================================\n');
    
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === '--user' && args[1]) {
        // Check specific user
        await checkSpecificUser(args[1]);
    } else {
        // Check all pending payments
        await checkPendingPayments();
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    
    console.log('\n✅ Script completed successfully!');
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { checkPendingPayments, checkSpecificUser };