#!/usr/bin/env node

/**
 * Comprehensive User Search Script
 * Searches for users with various patterns and shows related purchases
 */

const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');
require('dotenv').config();

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

async function searchForHimani() {
    try {
        console.log('🔍 Comprehensive search for Himani Saraf...\n');
        
        // Search patterns
        const searchPatterns = [
            'himanisaraf7@gmail.com',
            'himani.saraf7@gmail.com',
            'himanisaraf@gmail.com',
            'himani@gmail.com'
        ];
        
        console.log('📧 Searching by email patterns:');
        for (const email of searchPatterns) {
            console.log(`   Trying: ${email}`);
            const user = await User.findOne({ email: { $regex: email, $options: 'i' } });
            if (user) {
                console.log(`   ✅ Found exact match!`);
                displayUserInfo(user);
                return user;
            }
        }
        
        // Search by name patterns
        console.log('\n👤 Searching by name patterns:');
        const namePatterns = [
            'Himani Saraf',
            'himani saraf',
            'Himani',
            'himani'
        ];
        
        for (const name of namePatterns) {
            console.log(`   Trying: ${name}`);
            const users = await User.find({ name: { $regex: name, $options: 'i' } });
            if (users.length > 0) {
                console.log(`   ✅ Found ${users.length} match(es)!`);
                users.forEach((user, index) => {
                    console.log(`\n   Match ${index + 1}:`);
                    displayUserInfo(user);
                });
                return users[0]; // Return first match
            }
        }
        
        // Search by email containing "himani"
        console.log('\n🔎 Searching emails containing "himani":');
        const himaniUsers = await User.find({ email: { $regex: 'himani', $options: 'i' } });
        if (himaniUsers.length > 0) {
            console.log(`   ✅ Found ${himaniUsers.length} match(es)!`);
            himaniUsers.forEach((user, index) => {
                console.log(`\n   Match ${index + 1}:`);
                displayUserInfo(user);
            });
            return himaniUsers[0];
        }
        
        // Search by phone number if available
        console.log('\n📱 Searching by partial phone numbers:');
        const phonePatterns = ['7', '8', '9']; // Common starting digits
        for (const digit of phonePatterns) {
            const users = await User.find({ 
                contactNo: { $regex: `^${digit}`, $options: 'i' },
                name: { $regex: 'himani', $options: 'i' }
            });
            if (users.length > 0) {
                console.log(`   ✅ Found ${users.length} match(es) with phone starting with ${digit}!`);
                users.forEach((user, index) => {
                    console.log(`\n   Match ${index + 1}:`);
                    displayUserInfo(user);
                });
                return users[0];
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Error searching for user:', error.message);
        return null;
    }
}

async function searchPurchasesByOrderId() {
    try {
        console.log('\n💳 Searching for order_f8cbc23071f5...');
        
        const orderId = 'order_f8cbc23071f5';
        const purchase = await Purchase.findOne({ orderId: orderId });
        
        if (purchase) {
            console.log('✅ Found purchase record!');
            console.log('\n📄 PURCHASE DETAILS:');
            console.log('====================');
            console.log(`Order ID: ${purchase.orderId}`);
            console.log(`Status: ${purchase.paymentStatus || purchase.status}`);
            console.log(`Amount: ₹${purchase.amount || purchase.totalAmount}`);
            console.log(`Created: ${purchase.createdAt}`);
            console.log(`Completed: ${purchase.paymentCompletedAt || purchase.completedAt || 'N/A'}`);
            
            // Check user details in purchase
            if (purchase.userDetails) {
                console.log('\n👤 USER DETAILS FROM PURCHASE:');
                console.log('==============================');
                console.log(`Name: ${purchase.userDetails.name}`);
                console.log(`Email: ${purchase.userDetails.email}`);
                console.log(`Phone: ${purchase.userDetails.contactNo || purchase.userDetails.phone || 'N/A'}`);
                
                // Try to find user with this email
                const email = purchase.userDetails.email;
                if (email) {
                    console.log(`\n🔍 Searching for user with email: ${email}`);
                    const user = await User.findOne({ email: email });
                    if (user) {
                        console.log('✅ Found matching user record!');
                        displayUserInfo(user);
                        return user;
                    } else {
                        console.log('❌ No user record found with this email');
                        console.log('💡 User might need to be created from purchase data');
                    }
                }
            }
            
            if (purchase.customerDetails) {
                console.log('\n🛍️ CUSTOMER DETAILS FROM PURCHASE:');
                console.log('===================================');
                console.log(`Name: ${purchase.customerDetails.name}`);
                console.log(`Email: ${purchase.customerDetails.email}`);
                console.log(`Phone: ${purchase.customerDetails.phone || 'N/A'}`);
            }
            
            if (purchase.items && purchase.items.length > 0) {
                console.log('\n🛒 PURCHASED ITEMS:');
                console.log('===================');
                purchase.items.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.itemName || item.title || item.name}`);
                    console.log(`   Price: ₹${item.price || item.amount}`);
                    console.log(`   Quantity: ${item.quantity || 1}`);
                });
            }
            
            return purchase;
        } else {
            console.log('❌ No purchase found with order ID:', orderId);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error searching for purchase:', error.message);
        return null;
    }
}

function displayUserInfo(user) {
    console.log('📋 USER INFORMATION:');
    console.log('====================');
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
    console.log('====================\n');
}

async function createUserFromPurchase(purchase) {
    try {
        console.log('\n🆕 Creating user from purchase data...');
        
        const userDetails = purchase.userDetails || purchase.customerDetails;
        if (!userDetails || !userDetails.email) {
            console.log('❌ Insufficient user details in purchase record');
            return null;
        }
        
        // Determine events from purchased items
        const events = [];
        if (purchase.items && purchase.items.length > 0) {
            purchase.items.forEach(item => {
                const itemName = (item.itemName || item.title || item.name || '').toUpperCase();
                if (itemName.includes('BGMI') || itemName.includes('BATTLEGROUND')) {
                    events.push('BGMI TOURNAMENT');
                } else if (itemName.includes('VALORANT')) {
                    events.push('VALORANT TOURNAMENT');
                } else if (itemName.includes('FREE FIRE')) {
                    events.push('FREE FIRE TOURNAMENT');
                } else if (itemName.includes('COURTROOM')) {
                    events.push('COURTROOM');
                } else if (itemName.includes('DANCE')) {
                    events.push('DANCE BATTLE');
                } else if (itemName.includes('BAND')) {
                    events.push('BANDJAM');
                }
            });
        }
        
        // If no events detected, default to BGMI based on context
        if (events.length === 0) {
            events.push('BGMI TOURNAMENT');
        }
        
        const newUser = new User({
            name: userDetails.name,
            email: userDetails.email,
            contactNo: userDetails.contactNo || userDetails.phone,
            universityName: userDetails.universityName || 'Unknown',
            events: events,
            isvalidated: true, // Since payment was successful
            emailSent: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await newUser.save();
        console.log('✅ User created successfully!');
        displayUserInfo(newUser);
        
        return newUser;
        
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        return null;
    }
}

async function main() {
    console.log('🎯 Comprehensive User Search for Himani Saraf');
    console.log('==============================================\n');
    
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    try {
        // First, try to find existing user
        let user = await searchForHimani();
        
        if (!user) {
            console.log('\n❌ No user found in database');
            
            // Search for purchase record
            const purchase = await searchPurchasesByOrderId();
            
            if (purchase) {
                const createUser = true; // You can make this interactive if needed
                if (createUser) {
                    user = await createUserFromPurchase(purchase);
                }
            }
        }
        
        if (user) {
            console.log('\n🎉 User found/created! You can now use this data:');
            console.log(`   Email: ${user.email}`);
            console.log(`   ObjectId: ${user._id}`);
            console.log('\n💡 Use this in the interactive script:');
            console.log(`   node interactive-qr-manager.js`);
            console.log(`   Then enter: ${user.email}`);
        } else {
            console.log('\n❌ Could not find or create user record');
            console.log('💡 Check if the email address is correct or if there are any typos');
        }
        
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        console.log('✅ Search completed!');
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { searchForHimani, searchPurchasesByOrderId, createUserFromPurchase };