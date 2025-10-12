const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { Purchase, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');

async function processSuccessfulPayment(purchase, cashfreeOrderId) {
    try {
        console.log('\n✅ Processing successful payment...');

        // Update purchase status
        purchase.paymentStatus = 'completed';
        purchase.paymentCompletedAt = new Date();
        if (!purchase.cashfreeOrderId) {
            purchase.cashfreeOrderId = cashfreeOrderId;
        }

        // Find or create user
        let user = purchase.userId || purchase.mainPersonId;
        if (user) {
            // If user is an ObjectId, fetch the document
            if (typeof user === 'object' && user.constructor.name === 'ObjectId') {
                user = await User.findById(user);
            }
            // If user is still not a document (shouldn't happen), set to null
            if (!user || typeof user.save !== 'function') {
                user = null;
            }
        }
        
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
        }        // Generate QR code if not exists
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

async function updatePaymentsFromCSV(csvFilePath) {
    try {
        console.log('🚀 Starting payment update from CSV...');

        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        const ordersFromCSV = [];

        // Read CSV file
        console.log(`📄 Reading CSV file: ${csvFilePath}`);
        await new Promise((resolve, reject) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    const orderId = row['Order Id'];
                    const cashfreeOrderId = row['Cashfree Order ID'];
                    const transactionStatus = row['Transaction Status'];

                    if (orderId && transactionStatus === 'SUCCESS') {
                        ordersFromCSV.push({
                            orderId: orderId.trim(),
                            cashfreeOrderId: cashfreeOrderId ? cashfreeOrderId.trim() : null
                        });
                    }
                })
                .on('end', () => {
                    console.log(`📊 Read ${ordersFromCSV.length} successful orders from CSV`);
                    resolve();
                })
                .on('error', reject);
        });

        if (ordersFromCSV.length === 0) {
            console.log('❌ No successful orders found in CSV');
            return;
        }

        console.log('\n🔄 Processing orders...');
        console.log('='.repeat(80));

        const results = {
            processed: 0,
            updated: 0,
            skipped: 0,
            notFound: 0,
            errors: []
        };

        // Process each order
        for (let i = 0; i < ordersFromCSV.length; i++) {
            const csvOrder = ordersFromCSV[i];
            const orderNumber = i + 1;

            try {
                console.log(`\n[${orderNumber}/${ordersFromCSV.length}] Processing Order: ${csvOrder.orderId}`);
                console.log('-'.repeat(60));

                // Find purchase in database
                const purchase = await Purchase.findOne({ orderId: csvOrder.orderId });

                if (!purchase) {
                    console.log('❌ Purchase not found in database');
                    results.notFound++;
                    continue;
                }

                console.log('📋 Current purchase details:');
                console.log(`   Order ID: ${purchase.orderId}`);
                console.log(`   Cashfree Order ID: ${purchase.cashfreeOrderId || 'Not set'}`);
                console.log(`   Current Status: ${purchase.paymentStatus || 'pending'}`);
                console.log(`   Total Amount: ₹${purchase.totalAmount}`);
                console.log(`   User Registered: ${purchase.userRegistered ? '✅' : '❌'}`);
                console.log(`   QR Generated: ${purchase.qrGenerated ? '✅' : '❌'}`);
                console.log(`   Email Sent: ${purchase.emailSent ? '✅' : '❌'}`);

                results.processed++;

                // Check if already completed
                if (purchase.paymentStatus === 'completed' && purchase.userRegistered === true) {
                    console.log('✅ Purchase already fully processed - skipping');
                    results.skipped++;
                    continue;
                }

                // Process the payment
                console.log('🔄 Processing payment update...');
                const result = await processSuccessfulPayment(purchase, csvOrder.cashfreeOrderId);

                if (result.success) {
                    console.log('✅ Order status updated successfully!');
                    if (result.user) {
                        console.log(`👤 User: ${result.user.name} (${result.user.email})`);
                        console.log(`🎫 Events: ${result.user.events.join(', ')}`);
                    }
                    results.updated++;
                } else {
                    console.log('❌ Failed to process payment:', result.error);
                    results.errors.push(`${csvOrder.orderId}: ${result.error}`);
                }

                // Add delay to avoid overwhelming the system
                if (i < ordersFromCSV.length - 1) {
                    console.log('⏳ Waiting 1 second before next order...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (orderError) {
                console.error(`❌ Error processing order ${csvOrder.orderId}:`, orderError.message);
                results.errors.push(`${csvOrder.orderId}: ${orderError.message}`);
            }
        }

        // Final summary
        console.log('\n🎉 CSV PROCESSING COMPLETED');
        console.log('='.repeat(80));
        console.log(`📊 Processing Summary:`);
        console.log(`   Total Orders in CSV: ${ordersFromCSV.length}`);
        console.log(`   Orders Processed: ${results.processed}`);
        console.log(`   Orders Updated: ${results.updated}`);
        console.log(`   Orders Skipped (already completed): ${results.skipped}`);
        console.log(`   Orders Not Found: ${results.notFound}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        console.log(`\n📅 Completed at: ${new Date().toLocaleString()}`);

    } catch (error) {
        console.error('❌ CSV processing failed:', error);
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
const requiredEnvVars = ['mongodb'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
}

// Get CSV file path from command line arguments
const csvFilePath = process.argv[2] || '/home/sury/proj/sabrang_mixx/sabrangAll/sabrang_self_backend/newfinal.csv';

if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
}

// Run the script
console.log('🔄 PAYMENT UPDATE FROM CSV SCRIPT');
console.log('===================================');
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`📄 CSV File: ${csvFilePath}`);
console.log('⚠️ This will update purchase statuses and register users for successful payments\n');

updatePaymentsFromCSV(csvFilePath);