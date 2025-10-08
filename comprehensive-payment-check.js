#!/usr/bin/env node

/**
 * Comprehensive Payment & QR Code Status Checker
 * 
 * This script:
 * 1. Checks all completed payments and ensures users have QR codes
 * 2. Verifies payment statuses with Cashfree for recent orders
 * 3. Generates missing QR codes for completed payments
 * 4. Provides a detailed report of users who were updated
 */

const mongoose = require('mongoose');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const { Purchase, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Initialize Cashfree with proper environment configuration
const cashfreeEnvironment = process.env.NODE_ENV === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
console.log(`🔧 Initializing Cashfree in ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'} mode`);

const cashfree = new Cashfree(
  cashfreeEnvironment, 
  process.env.CASHFREE_APP_ID, 
  process.env.CASHFREE_SECRET_KEY
);

// Set API version for Cashfree SDK
const CASHFREE_API_VERSION = "2022-09-01";

// Track processed users for the report
const processedUsers = [];

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
        const response = await cashfree.PGOrderFetchPayments(CASHFREE_API_VERSION, orderId);
        
        if (response && response.data && response.data.length > 0) {
            const payment = response.data[0];
            console.log(`   Cashfree status: ${payment.payment_status}`);
            
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
        console.error(`   ⚠️ Error checking Cashfree status for ${orderId}:`, error.message);
        return null;
    }
}

async function generateMissingQRCode(user) {
    try {
        console.log(`   🏗️ Generating QR code for user: ${user.email}`);
        
        const qrCodeBase64 = await generateUserQRCode(user._id, {
            name: user.name,
            email: user.email,
            events: user.events,
            userId: user._id
        });
        
        if (qrCodeBase64) {
            user.qrCodeBase64 = qrCodeBase64;
            user.qrPath = `qr_${user._id}.png`;
            await user.save();
            console.log(`   ✅ QR code generated and saved successfully`);
            return true;
        } else {
            console.log(`   ❌ QR code generation failed: No QR code returned`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ QR code generation error: ${error.message}`);
        return false;
    }
}

async function checkCompletedPayments() {
    console.log('🔍 Checking all completed payments for missing QR codes...\n');
    
    try {
        // Find all completed purchases
        const completedPurchases = await Purchase.find({
            $or: [
                { paymentStatus: 'completed' },
                { status: 'SUCCESS' },
                { status: 'PAID' }
            ]
        }).sort({ createdAt: -1 });
        
        console.log(`📋 Found ${completedPurchases.length} completed purchases to verify\n`);
        
        if (completedPurchases.length === 0) {
            console.log('✅ No completed purchases found.');
            return;
        }
        
        let qrGeneratedCount = 0;
        let alreadyHadQRCount = 0;
        let failedQRCount = 0;
        let newUsersCreated = 0;
        let usersUpdated = 0;
        
        for (const purchase of completedPurchases) {
            console.log(`\n📦 Processing purchase: ${purchase.orderId}`);
            
            const userEmail = purchase.userDetails?.email || purchase.customerDetails?.email;
            if (!userEmail) {
                console.log(`   ⚠️ No email found in purchase record, skipping`);
                continue;
            }
            
            console.log(`   📧 Email: ${userEmail}`);
            console.log(`   💰 Amount: ${purchase.amount || purchase.totalAmount || 'N/A'}`);
            console.log(`   📅 Created: ${purchase.createdAt ? purchase.createdAt.toLocaleDateString() : 'N/A'}`);
            console.log(`   🎫 Events: ${purchase.items?.map(i => i.itemName || i.title).join(', ') || 'N/A'}`);
            
            // Find or create user
            let user = await User.findOne({ email: userEmail });
            
            if (!user) {
                console.log(`   👤 Creating new user for: ${userEmail}`);
                // Create user from purchase data
                const userData = purchase.userDetails || purchase.customerDetails;
                const eventNames = purchase.items?.map(item => item.itemName || item.title).filter(Boolean) || [];
                
                user = new User({
                    name: userData.name,
                    email: userEmail,
                    password: '$2b$12$default.hash',
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
                
                await user.save();
                newUsersCreated++;
                console.log(`   ✅ New user created successfully`);
            } else {
                console.log(`   👤 Found existing user: ${user.name}`);
                
                // Update user with new events if needed
                const eventNames = purchase.items?.map(item => item.itemName || item.title).filter(Boolean) || [];
                const newEvents = eventNames.filter(event => !user.events.includes(event));
                if (newEvents.length > 0) {
                    user.events.push(...newEvents);
                    user.updatedAt = new Date();
                    await user.save();
                    usersUpdated++;
                    console.log(`   📝 Added new events: ${newEvents.join(', ')}`);
                }
            }
            
            // Check and generate QR code if missing
            if (!user.qrPath && !user.qrCodeBase64) {
                console.log(`   🚫 QR code missing, generating...`);
                const qrGenerated = await generateMissingQRCode(user);
                if (qrGenerated) {
                    qrGeneratedCount++;
                    processedUsers.push({
                        email: user.email,
                        name: user.name,
                        orderId: purchase.orderId,
                        events: user.events,
                        action: 'QR_GENERATED',
                        amount: purchase.amount || purchase.totalAmount
                    });
                } else {
                    failedQRCount++;
                }
            } else {
                console.log(`   ✅ QR code already exists: ${user.qrPath || 'base64 format'}`);
                alreadyHadQRCount++;
                processedUsers.push({
                    email: user.email,
                    name: user.name,
                    orderId: purchase.orderId,
                    events: user.events,
                    action: 'ALREADY_HAD_QR',
                    amount: purchase.amount || purchase.totalAmount
                });
            }
            
            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n=====================================');
        console.log('📊 PROCESSING SUMMARY:');
        console.log(`   Total purchases checked: ${completedPurchases.length}`);
        console.log(`   New users created: ${newUsersCreated}`);
        console.log(`   Existing users updated: ${usersUpdated}`);
        console.log(`   New QR codes generated: ${qrGeneratedCount}`);
        console.log(`   Already had QR codes: ${alreadyHadQRCount}`);
        console.log(`   Failed QR generations: ${failedQRCount}`);
        
    } catch (error) {
        console.error('❌ Error checking completed payments:', error);
    }
}

async function checkRecentPaymentStatuses() {
    console.log('\n🔍 Checking recent payment statuses with Cashfree...\n');
    
    try {
        // Get recent purchases (last 30 days) to verify with Cashfree
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentPurchases = await Purchase.find({
            createdAt: { $gte: thirtyDaysAgo }
        }).sort({ createdAt: -1 }).limit(20); // Limit to avoid rate limiting
        
        console.log(`📋 Found ${recentPurchases.length} recent purchases to verify with Cashfree\n`);
        
        let verifiedCount = 0;
        let inconsistentCount = 0;
        
        for (const purchase of recentPurchases) {
            console.log(`\n🔍 Verifying purchase: ${purchase.orderId}`);
            console.log(`   Local Status: ${purchase.paymentStatus || purchase.status}`);
            
            const cashfreeStatus = await checkCashfreePaymentStatus(purchase.orderId);
            
            if (cashfreeStatus) {
                const localStatus = purchase.paymentStatus || purchase.status;
                const cashfreeStatusMapped = cashfreeStatus.status === 'SUCCESS' ? 'completed' : 
                                           cashfreeStatus.status === 'FAILED' ? 'failed' : 'pending';
                
                if (localStatus !== cashfreeStatusMapped) {
                    console.log(`   ⚠️ Status mismatch! Local: ${localStatus}, Cashfree: ${cashfreeStatus.status}`);
                    inconsistentCount++;
                } else {
                    console.log(`   ✅ Status consistent: ${cashfreeStatus.status}`);
                    verifiedCount++;
                }
            }
            
            // Delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n=====================================');
        console.log('🔍 VERIFICATION SUMMARY:');
        console.log(`   Purchases verified: ${verifiedCount}`);
        console.log(`   Inconsistent statuses: ${inconsistentCount}`);
        
    } catch (error) {
        console.error('❌ Error verifying payment statuses:', error);
    }
}

function generateUserReport() {
    console.log('\n📋 USER PROCESSING REPORT');
    console.log('==========================\n');
    
    if (processedUsers.length === 0) {
        console.log('No users were processed in this run.');
        return;
    }
    
    // Group by action
    const qrGenerated = processedUsers.filter(u => u.action === 'QR_GENERATED');
    const alreadyHadQR = processedUsers.filter(u => u.action === 'ALREADY_HAD_QR');
    
    if (qrGenerated.length > 0) {
        console.log('🎉 USERS WITH NEWLY GENERATED QR CODES:');
        console.log('----------------------------------------');
        qrGenerated.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email})`);
            console.log(`   Order ID: ${user.orderId}`);
            console.log(`   Amount: ₹${user.amount}`);
            console.log(`   Events: ${user.events.join(', ')}`);
            console.log('');
        });
        
        console.log(`🎯 Total users with new QR codes: ${qrGenerated.length}\n`);
    }
    
    if (alreadyHadQR.length > 0) {
        console.log('✅ USERS WHO ALREADY HAD QR CODES:');
        console.log('-----------------------------------');
        alreadyHadQR.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email}) - Order: ${user.orderId}`);
        });
        
        console.log(`📊 Total users who already had QR codes: ${alreadyHadQR.length}\n`);
    }
    
    // Calculate total value processed
    const totalValue = processedUsers.reduce((sum, user) => sum + (user.amount || 0), 0);
    console.log(`💰 Total transaction value processed: ₹${totalValue.toLocaleString()}`);
}

async function main() {
    console.log('🚀 Comprehensive Payment & QR Code Status Checker');
    console.log('=================================================\n');
    
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    // Check all completed payments
    await checkCompletedPayments();
    
    // Verify recent payment statuses with Cashfree
    await checkRecentPaymentStatuses();
    
    // Generate detailed user report
    generateUserReport();
    
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

module.exports = { checkCompletedPayments, checkRecentPaymentStatuses };