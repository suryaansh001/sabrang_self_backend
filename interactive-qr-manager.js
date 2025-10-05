#!/usr/bin/env node

/**
 * Interactive QR Generator and Event Manager
 * 
 * This script allows you to:
 * 1. Enter user ObjectId or email
 * 2. View/add events to user's events array
 * 3. Generate QR code for the user
 * 4. Send registration email with QR code
 * 5. Update user validation status
 */

const mongoose = require('mongoose');
const readline = require('readline');
const { User, Purchase } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Create readline interface for interactive input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline question
const question = (prompt) => {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
};

async function connectToDatabase() {
    try {
        const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function findUser(input) {
    try {
        let user;
        
        // Check if input is ObjectId or email
        if (mongoose.Types.ObjectId.isValid(input)) {
            console.log(`🔍 Searching by ObjectId: ${input}`);
            user = await User.findById(input);
        } else if (input.includes('@')) {
            console.log(`🔍 Searching by email: ${input}`);
            user = await User.findOne({ email: input });
        } else {
            console.log(`❌ Invalid input. Please provide a valid ObjectId or email address.`);
            return null;
        }
        
        if (!user) {
            console.log(`❌ User not found with identifier: ${input}`);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('❌ Error finding user:', error.message);
        return null;
    }
}

function displayUserInfo(user) {
    console.log('\n📋 USER INFORMATION:');
    console.log('========================');
    console.log(`ID: ${user._id}`);
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Phone: ${user.contactNo || 'N/A'}`);
    console.log(`University: ${user.universityName || 'N/A'}`);
    console.log(`Events: [${user.events.join(', ')}]`);
    console.log(`Validated: ${user.isvalidated ? '✅ Yes' : '❌ No'}`);
    console.log(`QR Code: ${user.qrPath ? '✅ Generated' : '❌ Not generated'}`);
    console.log(`Email Sent: ${user.emailSent ? '✅ Yes' : '❌ No'}`);
    console.log(`Created: ${user.createdAt}`);
    console.log('========================\n');
}

async function addEventToUser(user) {
    try {
        console.log('\n📝 AVAILABLE EVENTS:');
        const availableEvents = [
            'BGMI TOURNAMENT',
            'VALORANT TOURNAMENT', 
            'FREE FIRE TOURNAMENT',
            'COURTROOM',
            'RAMPWALK - PANACHE',
            'DANCE BATTLE',
            'BANDJAM',
            'STEP UP',
            'ECHOES OF NOOR',
            'VERSEVAAD',
            'ART RELAY',
            'CLAY MODELLING',
            'VISITOR_PASS'
        ];
        
        availableEvents.forEach((event, index) => {
            const isSelected = user.events.includes(event) ? '✅' : '⚪';
            console.log(`${index + 1}. ${isSelected} ${event}`);
        });
        
        console.log(`\nCurrent user events: [${user.events.join(', ')}]`);
        
        const eventInput = await question('\nEnter event name or number to add (or "done" to finish): ');
        
        if (eventInput.toLowerCase() === 'done') {
            return user;
        }
        
        let eventToAdd;
        
        // Check if input is a number
        const eventIndex = parseInt(eventInput) - 1;
        if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < availableEvents.length) {
            eventToAdd = availableEvents[eventIndex];
        } else {
            // Check if it's a valid event name
            eventToAdd = availableEvents.find(event => 
                event.toLowerCase().includes(eventInput.toLowerCase())
            );
        }
        
        if (!eventToAdd) {
            console.log(`❌ Event not found: ${eventInput}`);
            return await addEventToUser(user);
        }
        
        if (user.events.includes(eventToAdd)) {
            console.log(`⚠️ User already has event: ${eventToAdd}`);
        } else {
            user.events.push(eventToAdd);
            console.log(`✅ Added event: ${eventToAdd}`);
        }
        
        // Ask if they want to add more events
        const addMore = await question('Add another event? (y/n): ');
        if (addMore.toLowerCase() === 'y' || addMore.toLowerCase() === 'yes') {
            return await addEventToUser(user);
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Error adding event:', error.message);
        return user;
    }
}

async function removeEventFromUser(user) {
    try {
        if (user.events.length === 0) {
            console.log('❌ User has no events to remove.');
            return user;
        }
        
        console.log('\n📝 CURRENT USER EVENTS:');
        user.events.forEach((event, index) => {
            console.log(`${index + 1}. ${event}`);
        });
        
        const eventInput = await question('\nEnter event name or number to remove (or "done" to finish): ');
        
        if (eventInput.toLowerCase() === 'done') {
            return user;
        }
        
        let eventToRemove;
        
        // Check if input is a number
        const eventIndex = parseInt(eventInput) - 1;
        if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < user.events.length) {
            eventToRemove = user.events[eventIndex];
        } else {
            // Check if it's a valid event name
            eventToRemove = user.events.find(event => 
                event.toLowerCase().includes(eventInput.toLowerCase())
            );
        }
        
        if (!eventToRemove) {
            console.log(`❌ Event not found: ${eventInput}`);
            return await removeEventFromUser(user);
        }
        
        user.events = user.events.filter(event => event !== eventToRemove);
        console.log(`✅ Removed event: ${eventToRemove}`);
        
        // Ask if they want to remove more events
        const removeMore = await question('Remove another event? (y/n): ');
        if (removeMore.toLowerCase() === 'y' || removeMore.toLowerCase() === 'yes') {
            return await removeEventFromUser(user);
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Error removing event:', error.message);
        return user;
    }
}

async function generateQRCodeForUser(user) {
    try {
        console.log('\n🏗️ Generating QR code...');
        
        if (user.qrPath || user.qrCodeBase64) {
            const regenerate = await question('User already has a QR code. Regenerate? (y/n): ');
            if (regenerate.toLowerCase() !== 'y' && regenerate.toLowerCase() !== 'yes') {
                console.log('✅ Keeping existing QR code');
                return user;
            }
        }
        
        const qrCodeBase64 = await generateUserQRCode(user._id, {
            name: user.name,
            email: user.email,
            events: user.events,
            userId: user._id
        });
        
        if (qrCodeBase64) {
            user.qrPath = `qr_${user._id}.png`; // Set a virtual path
            user.qrCodeBase64 = qrCodeBase64;
            console.log(`✅ QR code generated successfully!`);
            console.log(`   Virtual Path: ${user.qrPath}`);
        } else {
            console.log(`❌ QR code generation failed: No QR code returned`);
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Error generating QR code:', error.message);
        return user;
    }
}

async function sendUserRegistrationEmail(user) {
    try {
        console.log('\n📧 Sending registration email...');
        
        if (!user.qrCodeBase64 && !user.qrPath) {
            console.log('⚠️ No QR code found. Generate QR code first before sending email.');
            return user;
        }
        
        const emailData = {
            name: user.name,
            events: user.events,
            qrCodeBase64: user.qrCodeBase64
        };
        
        const emailResult = await sendRegistrationEmail(user.email, emailData);
        
        if (emailResult.success) {
            user.emailSent = true;
            user.emailSentAt = new Date();
            console.log(`✅ Registration email sent successfully to: ${user.email}`);
        } else {
            console.log(`❌ Email sending failed: ${emailResult.error}`);
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        return user;
    }
}

async function updateUserValidation(user) {
    try {
        const currentStatus = user.isvalidated ? 'Validated' : 'Not Validated';
        console.log(`\nCurrent validation status: ${currentStatus}`);
        
        const newStatus = await question('Set validation status (true/false): ');
        
        if (newStatus.toLowerCase() === 'true' || newStatus.toLowerCase() === 't') {
            user.isvalidated = true;
            console.log('✅ User set as validated');
        } else if (newStatus.toLowerCase() === 'false' || newStatus.toLowerCase() === 'f') {
            user.isvalidated = false;
            console.log('❌ User set as not validated');
        } else {
            console.log('⚠️ Invalid input. Keeping current status.');
        }
        
        return user;
        
    } catch (error) {
        console.error('❌ Error updating validation status:', error.message);
        return user;
    }
}

async function showUserPurchases(user) {
    try {
        console.log('\n💳 RELATED PURCHASES:');
        console.log('=====================');
        
        const purchases = await Purchase.find({
            $or: [
                { 'userDetails.email': user.email },
                { 'customerDetails.email': user.email }
            ]
        }).sort({ createdAt: -1 });
        
        if (purchases.length === 0) {
            console.log('❌ No purchases found for this user.');
            return;
        }
        
        purchases.forEach((purchase, index) => {
            console.log(`\n${index + 1}. Order ID: ${purchase.orderId}`);
            console.log(`   Status: ${purchase.paymentStatus || purchase.status}`);
            console.log(`   Amount: ₹${purchase.amount || purchase.totalAmount}`);
            console.log(`   Items: ${purchase.items?.map(i => i.itemName || i.title).join(', ') || 'N/A'}`);
            console.log(`   Created: ${purchase.createdAt || purchase.purchaseDate}`);
            console.log(`   Completed: ${purchase.paymentCompletedAt || purchase.completedAt || 'N/A'}`);
        });
        
    } catch (error) {
        console.error('❌ Error fetching purchases:', error.message);
    }
}

async function processUser(user) {
    try {
        let currentUser = user;
        let hasChanges = false;
        
        while (true) {
            displayUserInfo(currentUser);
            
            console.log('🔧 AVAILABLE ACTIONS:');
            console.log('1. Add event');
            console.log('2. Remove event');
            console.log('3. Generate QR code');
            console.log('4. Send registration email');
            console.log('5. Update validation status');
            console.log('6. View purchases');
            console.log('7. Save changes and exit');
            console.log('8. Exit without saving');
            
            const action = await question('\nSelect action (1-8): ');
            
            switch (action) {
                case '1':
                    currentUser = await addEventToUser(currentUser);
                    hasChanges = true;
                    break;
                    
                case '2':
                    currentUser = await removeEventFromUser(currentUser);
                    hasChanges = true;
                    break;
                    
                case '3':
                    currentUser = await generateQRCodeForUser(currentUser);
                    hasChanges = true;
                    break;
                    
                case '4':
                    currentUser = await sendUserRegistrationEmail(currentUser);
                    hasChanges = true;
                    break;
                    
                case '5':
                    currentUser = await updateUserValidation(currentUser);
                    hasChanges = true;
                    break;
                    
                case '6':
                    await showUserPurchases(currentUser);
                    break;
                    
                case '7':
                    if (hasChanges) {
                        console.log('\n💾 Saving changes...');
                        currentUser.updatedAt = new Date();
                        await currentUser.save();
                        console.log('✅ User updated successfully!');
                    } else {
                        console.log('✅ No changes to save.');
                    }
                    return;
                    
                case '8':
                    console.log('❌ Exiting without saving changes.');
                    return;
                    
                default:
                    console.log('❌ Invalid option. Please select 1-8.');
                    break;
            }
            
            console.log('\nPress Enter to continue...');
            await question('');
            console.clear();
        }
        
    } catch (error) {
        console.error('❌ Error processing user:', error.message);
    }
}

async function main() {
    console.log('🎯 Interactive QR Generator and Event Manager');
    console.log('==============================================\n');
    
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
        rl.close();
        process.exit(1);
    }
    
    try {
        while (true) {
            const userInput = await question('Enter user ObjectId or email (or "exit" to quit): ');
            
            if (userInput.toLowerCase() === 'exit') {
                break;
            }
            
            const user = await findUser(userInput.trim());
            
            if (user) {
                await processUser(user);
                
                const continueInput = await question('\nProcess another user? (y/n): ');
                if (continueInput.toLowerCase() !== 'y' && continueInput.toLowerCase() !== 'yes') {
                    break;
                }
            } else {
                const retryInput = await question('Try again? (y/n): ');
                if (retryInput.toLowerCase() !== 'y' && retryInput.toLowerCase() !== 'yes') {
                    break;
                }
            }
            
            console.log('\n' + '='.repeat(50) + '\n');
        }
        
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        // Close connections
        rl.close();
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        console.log('✅ Script completed successfully!');
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n\n👋 Goodbye!');
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        rl.close();
        process.exit(1);
    });
}

module.exports = { findUser, processUser };