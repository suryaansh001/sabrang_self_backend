const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
const bcrypt = require('bcrypt');
const shortid = require('shortid');

// User data from the request
const usersToAdd = [
    {
        name: "Anant gupta",
        email: "ganant749@gmail.com",
        contactNo: "8764880898",
        gender: "Male",
        age: 19,
        universityName: "Jk Lakshmipat",
        referralCode: "SPECIALOFFER",
        address: "7 Main Sector Shastri Nagar",
        events: ["BIDDING BEFORE WICKET"]
    },
    {
        name: "Disha sharma",
        email: "dishasharma11011@gmail.com",
        contactNo: "9314139865",
        gender: "Female",
        age: 18,
        universityName: "Vgu",
        referralCode: "2025BBA107",
        address: "Plt no. 44 ramesh vihar nadi ka phatak jhotwara",
        events: ["VISITOR_PASS"]
    },
    {
        name: "Rachit Sharma",
        email: "myselfrachit0410@gmail.com",
        contactNo: "9351187511",
        gender: "Male",
        age: 20,
        universityName: "JK Lakshmipat University",
        referralCode: "Rachit Sharma",
        address: "43A Sitaram Vihar Extension",
        events: ["BIDDING BEFORE WICKET"]
    },
    {
        name: "Dev Jangir",
        email: "jangirdev7777@gmail.com",
        contactNo: "9828502424",
        gender: "Male",
        age: 18,
        universityName: "Poddar international college",
        referralCode: "SPECIALOFFER",
        address: "Patrakar colony sky desire near elnza circle",
        events: ["BGMI TOURNAMENT"]
    }
];

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
            userType: 'participant',
            isvalidated: true,
            hasEntered: false,
            emailSent: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await newUser.save();
        console.log(`✅ New user created successfully: ${newUser.name} (${newUser.email})`);
        console.log(`🎫 Events registered: ${newUser.events.join(', ')}`);
        
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
            userId: user._id
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
            qrCodeBase64: user.qrCodeBase64
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
            switch (eventName) {
                case 'VISITOR_PASS':
                    price = 69;
                    break;
                case 'BIDDING BEFORE WICKET':
                    price = 149.25;
                    break;
                case 'BGMI TOURNAMENT':
                    price = 562.5;
                    break;
                default:
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
        const orderId = `manual_${shortid.generate()}_${Date.now()}`;
        
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
                source: 'manual_entry',
                note: 'Manually added user with registration'
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

async function processAllUsers() {
    try {
        console.log('🚀 Starting user registration process...');
        console.log('=====================================');
        
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
        
        console.log(`📊 Processing ${usersToAdd.length} users...\n`);
        
        // Process each user
        for (let i = 0; i < usersToAdd.length; i++) {
            const userData = usersToAdd[i];
            const userNumber = i + 1;
            
            try {
                console.log(`[${userNumber}/${usersToAdd.length}] Processing: ${userData.name}`);
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
                
                // Add delay between users to avoid overwhelming the system
                if (i < usersToAdd.length - 1) {
                    console.log('⏳ Waiting 2 seconds before next user...\n');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (userError) {
                console.error(`❌ Error processing user ${userData.name}:`, userError.message);
                results.errors.push(`${userData.name}: ${userError.message}`);
            }
        }
        
        // Final summary
        console.log('\n🎉 USER REGISTRATION COMPLETED');
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
        for (const userData of usersToAdd) {
            const user = await User.findOne({ email: userData.email.toLowerCase().trim() });
            if (user) {
                console.log(`📋 ${user.name} (${user.email})`);
                console.log(`   Events: ${user.events.join(', ')}`);
                console.log(`   QR Generated: ${user.qrCodeBase64 ? '✅' : '❌'}`);
                console.log(`   Email Sent: ${user.emailSent ? '✅' : '❌'}`);
                console.log(`   Validated: ${user.isvalidated ? '✅' : '❌'}`);
                console.log('');
            }
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
console.log('🔄 MANUAL USER REGISTRATION SCRIPT');
console.log('===================================');
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`👥 Users to process: ${usersToAdd.length}`);
console.log('⚠️ This will create users, generate QR codes, send emails, and create purchase records\n');

processAllUsers();