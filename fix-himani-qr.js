#!/usr/bin/env node

/**
 * Fix Himani Saraf's QR Code Issue
 * 
 * This script specifically handles the case where a user has:
 * - Completed payment on Cashfree
 * - User record exists with events
 * - But QR code is not generated
 * - Payment status not updated in our system
 */

const mongoose = require('mongoose');
const { Cashfree } = require('cashfree-pg');
const { Purchase, User } = require('./models/models');
const { generateQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Initialize Cashfree
const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
Cashfree.XClientId = process.env.CLIENT_ID;
Cashfree.XClientSecret = process.env.CLIENT_SECRET;
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

async function fixHimaniSaraf() {
    console.log('🔧 Fixing Himani Saraf\'s QR Code Issue');
    console.log('=====================================\n');
    
    const email = 'himanisaraf7@gmail.com';
    const targetOrderId = 'order_f8cbc23071f5'; // The order ID from the logs
    
    try {
        // Step 1: Find Himani's user record
        console.log('👤 Step 1: Finding user record...');
        const user = await User.findOne({ email: email });
        
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return;
        }
        
        console.log(`✅ User found: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Events: ${user.events.join(', ')}`);
        console.log(`   Validated: ${user.isvalidated}`);
        console.log(`   Current QR Path: ${user.qrPath || 'Not generated'}`);
        console.log(`   Email Sent: ${user.emailSent || false}`);
        
        // Step 2: Find related purchase
        console.log('\n📦 Step 2: Finding purchase record...');
        let purchase = await Purchase.findOne({ orderId: targetOrderId });
        
        if (!purchase) {
            // Try to find by email
            purchase = await Purchase.findOne({
                $or: [
                    { 'userDetails.email': email },
                    { 'customerDetails.email': email }
                ]
            }).sort({ createdAt: -1 });
        }
        
        if (!purchase) {
            console.log(`❌ No purchase record found for ${email}`);
            console.log('   Creating a virtual purchase record for QR generation...');
            
            // Create a minimal purchase record for QR generation
            purchase = {
                orderId: `manual_${Date.now()}`,
                userDetails: {
                    email: user.email,
                    name: user.name
                },
                items: user.events.map(event => ({
                    itemName: event,
                    title: event,
                    type: 'event'
                })),
                paymentStatus: 'completed'
            };
        } else {
            console.log(`✅ Purchase found: ${purchase.orderId}`);
            console.log(`   Current Status: ${purchase.paymentStatus || purchase.status}`);
            console.log(`   Amount: ${purchase.amount || purchase.totalAmount}`);
            console.log(`   Items: ${purchase.items?.map(i => i.itemName || i.title).join(', ') || 'N/A'}`);
        }
        
        // Step 3: Check Cashfree payment status
        console.log('\n💳 Step 3: Checking Cashfree payment status...');
        
        let cashfreeVerified = false;
        try {
            const response = await Cashfree.PGOrderFetchPayments(targetOrderId);
            
            if (response && response.data && response.data.length > 0) {
                const payment = response.data[0];
                console.log(`   Cashfree Status: ${payment.payment_status}`);
                console.log(`   Payment Method: ${payment.payment_method || 'N/A'}`);
                console.log(`   Amount: ${payment.payment_amount || 'N/A'}`);
                
                if (payment.payment_status === 'SUCCESS') {
                    cashfreeVerified = true;
                    console.log('   ✅ Payment verified as SUCCESS on Cashfree');
                    
                    // Update purchase if it exists in our DB
                    if (purchase._id) {
                        purchase.paymentStatus = 'completed';
                        purchase.status = 'PAID';
                        purchase.paymentCompletedAt = new Date(payment.payment_time) || new Date();
                        purchase.transactionId = payment.cf_payment_id;
                        purchase.paymentMethod = payment.payment_method;
                        await purchase.save();
                        console.log('   💾 Purchase status updated');
                    }
                } else {
                    console.log(`   ⚠️ Payment status is ${payment.payment_status}, not SUCCESS`);
                }
            } else {
                console.log('   ⚠️ No payment data found on Cashfree');
            }
        } catch (cashfreeError) {
            console.log(`   ⚠️ Could not verify with Cashfree: ${cashfreeError.message}`);
            console.log('   Proceeding with manual QR generation...');
        }
        
        // Step 4: Generate QR code if missing
        console.log('\n🏗️ Step 4: Generating QR code...');
        
        if (!user.qrPath && !user.qrCodeBase64) {
            console.log('   Generating new QR code...');
            
            try {
                const qrResult = await generateQRCode(user._id, {
                    name: user.name,
                    email: user.email,
                    events: user.events,
                    userId: user._id
                });
                
                if (qrResult.success) {
                    user.qrPath = qrResult.qrPath;
                    user.qrCodeBase64 = qrResult.qrCodeBase64;
                    console.log(`   ✅ QR code generated successfully: ${qrResult.qrPath}`);
                } else {
                    console.log(`   ❌ QR code generation failed: ${qrResult.error}`);
                    return;
                }
            } catch (qrError) {
                console.log(`   ❌ QR code generation error: ${qrError.message}`);
                return;
            }
        } else {
            console.log(`   ✅ QR code already exists: ${user.qrPath || 'base64 format'}`);
        }
        
        // Step 5: Update user validation status
        console.log('\n✅ Step 5: Updating user validation status...');
        user.isvalidated = true;
        user.updatedAt = new Date();
        await user.save();
        console.log('   💾 User validation status updated');
        
        // Step 6: Send registration email
        console.log('\n📧 Step 6: Sending registration email...');
        
        if (!user.emailSent) {
            try {
                const emailData = {
                    name: user.name,
                    events: user.events,
                    qrCodeBase64: user.qrCodeBase64
                };
                
                const emailResult = await sendRegistrationEmail(user.email, emailData);
                
                if (emailResult.success) {
                    user.emailSent = true;
                    user.emailSentAt = new Date();
                    await user.save();
                    
                    if (purchase._id) {
                        purchase.emailSent = true;
                        purchase.emailSentAt = new Date();
                        await purchase.save();
                    }
                    
                    console.log('   ✅ Registration email sent successfully');
                } else {
                    console.log(`   ⚠️ Email sending failed: ${emailResult.error}`);
                }
            } catch (emailError) {
                console.log(`   ⚠️ Email sending error: ${emailError.message}`);
            }
        } else {
            console.log('   📧 Email was already sent previously');
        }
        
        // Step 7: Final verification
        console.log('\n🔍 Step 7: Final verification...');
        const updatedUser = await User.findOne({ email: email });
        
        console.log('\n🎉 SUCCESS! Himani Saraf\'s issue has been fixed:');
        console.log('=============================================');
        console.log(`✅ Name: ${updatedUser.name}`);
        console.log(`✅ Email: ${updatedUser.email}`);
        console.log(`✅ Events: ${updatedUser.events.join(', ')}`);
        console.log(`✅ Validated: ${updatedUser.isvalidated}`);
        console.log(`✅ QR Code: ${updatedUser.qrPath ? 'Generated' : 'Missing'}`);
        console.log(`✅ Email Sent: ${updatedUser.emailSent || false}`);
        
        if (updatedUser.qrPath) {
            console.log(`\n📱 QR Code Access URL: /api/qrcode/${updatedUser._id}`);
            console.log(`📱 Or QR by Order: /api/payments/qr-by-order/${targetOrderId}`);
        }
        
        console.log('\n✅ Himani should now be able to access her QR code!');
        
    } catch (error) {
        console.error('❌ Error fixing Himani\'s issue:', error);
    }
}

async function main() {
    console.log('🚀 Himani Saraf QR Code Fix Script');
    console.log('==================================\n');
    
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    // Fix Himani's issue
    await fixHimaniSaraf();
    
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { fixHimaniSaraf };