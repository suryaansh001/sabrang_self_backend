const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
const bcrypt = require('bcrypt');
const shortid = require('shortid');

// User data from the request
const userData = {
    name: "Kavyansh",
    email: "Kavyanshsingh87@gmail.com",
    contactNo: "6367126139",
    gender: "Male",
    age: 20,
    universityName: "Jklu",
    referralCode: "", // Not Available
    address: "Vaishali",
    events: ["VISITOR PASS 3 DAYS"],
    userType: "flagship_visitor", // For visitor pass
    visitorPassDays: 3
};

async function createUserWithQRAndEmail(userData) {
    try {
        console.log(`\n🔄 Processing user: ${userData.name} (${userData.email})`);

        // Check if user already exists
        let existingUser = await User.findOne({ email: userData.email.toLowerCase().trim() });

        if (existingUser) {
            console.log(`⚠️ User already exists: ${existingUser.name} (${existingUser.email})`);

            // Update existing user with new events if not already present
            let eventsAdded = false;
            userData.events.forEach(event => {
                if (!existingUser.events.includes(event)) {
                    existingUser.events.push(event);
                    eventsAdded = true;
                }
            });

            if (eventsAdded) {
                // Update other fields if provided
                if (userData.contactNo && !existingUser.contactNo) {
                    existingUser.contactNo = userData.contactNo;
                }
                if (userData.gender && !existingUser.gender) {
                    existingUser.gender = userData.gender;
                }
                if (userData.age && !existingUser.age) {
                    existingUser.age = userData.age;
                }
                if (userData.universityName && !existingUser.universityName) {
                    existingUser.universityName = userData.universityName;
                }
                if (userData.address && !existingUser.address) {
                    existingUser.address = userData.address;
                }
                if (userData.referralCode && !existingUser.referralCode) {
                    existingUser.referralCode = userData.referralCode;
                }
                if (userData.userType && !existingUser.userType) {
                    existingUser.userType = userData.userType;
                }
                if (userData.visitorPassDays && !existingUser.visitorPassDays) {
                    existingUser.visitorPassDays = userData.visitorPassDays;
                }

                existingUser.isvalidated = true;
                existingUser.updatedAt = new Date();

                await existingUser.save();
                console.log(`✅ Updated existing user with new events: ${userData.events.join(', ')}`);
                return existingUser;
            } else {
                console.log(`ℹ️ User already has all specified events: ${userData.events.join(', ')}`);
                return existingUser;
            }
        }

        // Create new user
        console.log(`👤 Creating new user...`);

        // Generate a default password
        const hashedPassword = await bcrypt.hash('defaultPassword123', 12);

        const newUser = new User({
            name: userData.name,
            email: userData.email.toLowerCase().trim(),
            contactNo: userData.contactNo || '',
            password: hashedPassword,
            gender: userData.gender || '',
            age: userData.age || null,
            universityName: userData.universityName || '',
            address: userData.address || '',
            referralCode: userData.referralCode || '',
            events: userData.events || [],
            userType: userData.userType || 'participant',
            visitorPassDays: userData.visitorPassDays || 0,
            isvalidated: true,
            hasEntered: false,
            emailSent: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newUser.save();
        console.log(`✅ New user created successfully: ${newUser.name} (${newUser.email})`);
        console.log(`🎫 Events registered: ${newUser.events.join(', ')}`);
        console.log(`🏷️ User Type: ${newUser.userType}`);
        if (newUser.visitorPassDays > 0) {
            console.log(`📅 Visitor Pass Days: ${newUser.visitorPassDays}`);
        }

        return newUser;

    } catch (error) {
        console.error(`❌ Error processing user ${userData.name}:`, error.message);
        throw error;
    }
}

async function generateQRForUser(user) {
    try {
        console.log(`🔄 Checking QR code for user: ${user.name}`);

        // Check if user already has QR code
        if (user.qrCodeBase64 || user.qrPath) {
            console.log(`✅ User already has QR code`);
            return true;
        }

        console.log(`🔄 Generating QR code...`);

        const qrCodeBase64 = await generateUserQRCode(user._id, {
            name: user.name,
            email: user.email,
            events: user.events,
            userId: user._id,
            userType: user.userType,
            visitorPassDays: user.visitorPassDays
        });

        if (qrCodeBase64) {
            user.qrPath = `qr_${user._id}.png`;
            user.qrCodeBase64 = qrCodeBase64;
            await user.save();
            console.log(`✅ QR code generated and saved successfully`);
            return true;
        } else {
            console.log(`⚠️ QR code generation failed`);
            return false;
        }

    } catch (error) {
        console.error(`❌ Error generating QR code for ${user.name}:`, error.message);
        return false;
    }
}

async function sendEmailToUser(user) {
    try {
        console.log(`📧 Checking email status for user: ${user.name}`);

        // Check if email was already sent
        if (user.emailSent) {
            console.log(`✅ Email was already sent to this user`);
            return true;
        }

        console.log(`📧 Sending registration email...`);

        const emailData = {
            name: user.name,
            events: user.events,
            qrCodeBase64: user.qrCodeBase64,
            userType: user.userType,
            visitorPassDays: user.visitorPassDays
        };

        const emailResult = await sendRegistrationEmail(user.email, emailData);

        if (emailResult.success) {
            user.emailSent = true;
            user.emailSentAt = new Date();
            await user.save();
            console.log(`✅ Registration email sent successfully`);
            return true;
        } else {
            console.log(`⚠️ Email sending failed:`, emailResult.error);
            return false;
        }

    } catch (error) {
        console.error(`❌ Error sending email to ${user.name}:`, error.message);
        return false;
    }
}

async function createPurchaseRecord(user, userData) {
    try {
        console.log(`📝 Creating purchase record for user: ${user.name}`);

        // Calculate total amount based on events
        let totalAmount = 0;
        const items = userData.events.map(eventName => {
            let price = 0;

            // Set prices based on event names
            if (eventName.includes('VISITOR PASS')) {
                price = 69; // Standard visitor pass price
            } else {
                price = 149.25; // Default price
            }

            totalAmount += price;

            return {
                type: 'event',
                itemId: eventName,
                itemName: eventName,
                quantity: 1,
                price: price
            };
        });

        // Generate order ID
        const orderId = `visitor_${shortid.generate()}_${Date.now()}`;

        const purchase = new Purchase({
            orderId: orderId,
            userId: user._id,
            mainPersonId: user._id,
            userDetails: {
                name: userData.name,
                email: userData.email,
                contactNo: userData.contactNo,
                gender: userData.gender,
                age: userData.age,
                universityName: userData.universityName,
                address: userData.address,
                referralCode: userData.referralCode
            },
            items: items,
            subtotal: totalAmount,
            totalAmount: totalAmount,
            paymentStatus: 'completed',
            paymentMethod: 'manual_entry',
            transactionId: `manual_${Date.now()}`,
            userRegistered: true,
            qrGenerated: !!(user.qrCodeBase64 || user.qrPath),
            emailSent: user.emailSent,
            purchaseDate: new Date(),
            paymentCompletedAt: new Date(),
            metadata: {
                source: 'manual_visitor_entry',
                note: 'Manually added visitor pass user',
                visitorPassDays: userData.visitorPassDays
            }
        });

        await purchase.save();
        console.log(`✅ Purchase record created: Order ID ${orderId}, Amount: ₹${totalAmount}`);

        return purchase;

    } catch (error) {
        console.error(`❌ Error creating purchase record for ${user.name}:`, error.message);
        throw error;
    }
}

async function processUser() {
    try {
        console.log('🚀 Starting visitor user registration process...');
        console.log('===============================================');

        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        const results = {
            processed: 0,
            created: 0,
            updated: 0,
            qrGenerated: 0,
            emailsSent: 0,
            purchasesCreated: 0,
            errors: []
        };

        console.log(`📊 Processing visitor user: ${userData.name}\n`);

        try {
            console.log(`Processing: ${userData.name}`);
            console.log('-'.repeat(60));

            // Step 1: Create or update user
            const user = await createUserWithQRAndEmail(userData);
            results.processed++;

            if (user.createdAt && new Date() - user.createdAt < 60000) { // Created in last minute
                results.created++;
            } else {
                results.updated++;
            }

            // Step 2: Generate QR code
            const qrSuccess = await generateQRForUser(user);
            if (qrSuccess) {
                results.qrGenerated++;
            }

            // Step 3: Send registration email
            const emailSuccess = await sendEmailToUser(user);
            if (emailSuccess) {
                results.emailsSent++;
            }

            // Step 4: Create purchase record
            const purchase = await createPurchaseRecord(user, userData);
            if (purchase) {
                results.purchasesCreated++;
            }

            console.log(`✅ User processing completed successfully!`);
            console.log(`📊 Status: User ✅ | QR ${qrSuccess ? '✅' : '❌'} | Email ${emailSuccess ? '✅' : '❌'} | Purchase ✅`);

        } catch (userError) {
            console.error(`❌ Error processing user ${userData.name}:`, userError.message);
            results.errors.push(`${userData.name}: ${userError.message}`);
        }

        // Final summary
        console.log('\n🎉 VISITOR USER REGISTRATION COMPLETED');
        console.log('='.repeat(60));
        console.log(`📊 Processing Summary:`);
        console.log(`   Total Users Processed: ${results.processed}`);
        console.log(`   New Users Created: ${results.created}`);
        console.log(`   Existing Users Updated: ${results.updated}`);
        console.log(`   QR Codes Generated: ${results.qrGenerated}`);
        console.log(`   Emails Sent: ${results.emailsSent}`);
        console.log(`   Purchase Records Created: ${results.purchasesCreated}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        console.log(`\n📅 Completed at: ${new Date().toLocaleString()}`);

        // Show user summary
        console.log('\n👥 USER SUMMARY:');
        console.log('='.repeat(60));
        const user = await User.findOne({ email: userData.email.toLowerCase().trim() });
        if (user) {
            console.log(`📋 ${user.name} (${user.email})`);
            console.log(`   Events: ${user.events.join(', ')}`);
            console.log(`   User Type: ${user.userType}`);
            console.log(`   Visitor Pass Days: ${user.visitorPassDays}`);
            console.log(`   QR Generated: ${user.qrCodeBase64 ? '✅' : '❌'}`);
            console.log(`   Email Sent: ${user.emailSent ? '✅' : '❌'}`);
            console.log(`   Validated: ${user.isvalidated ? '✅' : '❌'}`);
            console.log('');
        }

    } catch (error) {
        console.error('❌ Registration process failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        try {
            await mongoose.disconnect();
            console.log('📴 Disconnected from MongoDB');
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

// Run the script
console.log('🔄 VISITOR USER REGISTRATION SCRIPT');
console.log('====================================');
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`👤 User to process: ${userData.name} (${userData.email})`);
console.log(`🎫 Event: ${userData.events.join(', ')}`);
console.log(`🏷️ User Type: ${userData.userType}`);
console.log(`📅 Visitor Pass Days: ${userData.visitorPassDays}`);
console.log('⚠️ This will create user, generate QR code, send email, and create purchase record\n');

processUser();