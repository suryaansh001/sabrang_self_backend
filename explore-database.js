#!/usr/bin/env node

/**
 * Database Explorer Script
 * Explores the database to find recent purchases and user records
 */

const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');
require('dotenv').config();

async function connectToDatabase() {
    try {
        const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        console.log(`🔌 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function exploreDatabase() {
    try {
        console.log('🔍 Exploring database collections...\n');
        
        // Check total counts
        const userCount = await User.countDocuments();
        const purchaseCount = await Purchase.countDocuments();
        
        console.log('📊 COLLECTION STATISTICS:');
        console.log('=========================');
        console.log(`Total Users: ${userCount}`);
        console.log(`Total Purchases: ${purchaseCount}\n`);
        
        // Show recent purchases
        console.log('💳 RECENT PURCHASES (Last 10):');
        console.log('===============================');
        const recentPurchases = await Purchase.find({})
            .sort({ createdAt: -1 })
            .limit(10);
            
        recentPurchases.forEach((purchase, index) => {
            console.log(`${index + 1}. Order: ${purchase.orderId || 'N/A'}`);
            console.log(`   Status: ${purchase.paymentStatus || purchase.status || 'N/A'}`);
            console.log(`   Amount: ₹${purchase.amount || purchase.totalAmount || 'N/A'}`);
            console.log(`   Email: ${purchase.userDetails?.email || purchase.customerDetails?.email || 'N/A'}`);
            console.log(`   Created: ${purchase.createdAt || 'N/A'}`);
            console.log('');
        });
        
        // Search for orders containing 'f8cbc'
        console.log('🔎 SEARCHING FOR SIMILAR ORDER IDs (containing "f8cbc"):');
        console.log('=========================================================');
        const similarOrders = await Purchase.find({ 
            orderId: { $regex: 'f8cbc', $options: 'i' } 
        });
        
        if (similarOrders.length > 0) {
            similarOrders.forEach((purchase, index) => {
                console.log(`${index + 1}. Order: ${purchase.orderId}`);
                console.log(`   Status: ${purchase.paymentStatus || purchase.status}`);
                console.log(`   Email: ${purchase.userDetails?.email || purchase.customerDetails?.email}`);
                console.log(`   Created: ${purchase.createdAt}`);
                console.log('');
            });
        } else {
            console.log('❌ No orders found containing "f8cbc"\n');
        }
        
        // Search for any orders with similar pattern
        console.log('🔎 SEARCHING FOR ORDER IDs WITH PATTERN "order_*":');
        console.log('==================================================');
        const orderPattern = await Purchase.find({ 
            orderId: { $regex: '^order_', $options: 'i' } 
        }).sort({ createdAt: -1 }).limit(5);
        
        if (orderPattern.length > 0) {
            orderPattern.forEach((purchase, index) => {
                console.log(`${index + 1}. Order: ${purchase.orderId}`);
                console.log(`   Status: ${purchase.paymentStatus || purchase.status}`);
                console.log(`   Email: ${purchase.userDetails?.email || purchase.customerDetails?.email}`);
                console.log(`   Created: ${purchase.createdAt}`);
                console.log('');
            });
        } else {
            console.log('❌ No orders found with pattern "order_*"\n');
        }
        
        // Show recent users
        console.log('👥 RECENT USERS (Last 5):');
        console.log('==========================');
        const recentUsers = await User.find({})
            .sort({ createdAt: -1 })
            .limit(5);
            
        recentUsers.forEach((user, index) => {
            console.log(`${index + 1}. Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Events: [${user.events.join(', ')}]`);
            console.log(`   Validated: ${user.isvalidated ? '✅' : '❌'}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log('');
        });
        
        // Search for any email containing "himani"
        console.log('🔎 SEARCHING FOR EMAILS CONTAINING "himani":');
        console.log('=============================================');
        const himaniEmails = await User.find({ 
            email: { $regex: 'himani', $options: 'i' } 
        });
        
        if (himaniEmails.length > 0) {
            himaniEmails.forEach((user, index) => {
                console.log(`${index + 1}. Name: ${user.name}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Events: [${user.events.join(', ')}]`);
                console.log('');
            });
        } else {
            console.log('❌ No emails found containing "himani"\n');
        }
        
        // Check purchases with email containing himani
        console.log('🔎 SEARCHING PURCHASES FOR EMAILS CONTAINING "himani":');
        console.log('======================================================');
        const himaniPurchases = await Purchase.find({
            $or: [
                { 'userDetails.email': { $regex: 'himani', $options: 'i' } },
                { 'customerDetails.email': { $regex: 'himani', $options: 'i' } }
            ]
        });
        
        if (himaniPurchases.length > 0) {
            himaniPurchases.forEach((purchase, index) => {
                console.log(`${index + 1}. Order: ${purchase.orderId}`);
                console.log(`   Status: ${purchase.paymentStatus || purchase.status}`);
                console.log(`   Email: ${purchase.userDetails?.email || purchase.customerDetails?.email}`);
                console.log(`   Name: ${purchase.userDetails?.name || purchase.customerDetails?.name}`);
                console.log(`   Created: ${purchase.createdAt}`);
                console.log('');
            });
        } else {
            console.log('❌ No purchases found with emails containing "himani"\n');
        }
        
    } catch (error) {
        console.error('❌ Error exploring database:', error.message);
    }
}

async function main() {
    console.log('🎯 Database Explorer');
    console.log('====================\n');
    
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    try {
        await exploreDatabase();
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        console.log('✅ Exploration completed!');
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { exploreDatabase };