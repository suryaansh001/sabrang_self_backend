#!/usr/bin/env node

/**
 * Complete Payment Flow Test
 * Tests the entire flow from frontend data to successful payment processing
 * This addresses the issue where users had QR codes but empty events arrays
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const BASE_URL ='http://localhost:5000';

// Import models after setting up mongoose
let Purchase, User;

async function connectToMongoDB() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        console.log('🔌 Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // 5 second timeout
            connectTimeoutMS: 5000
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Import models after connection
        const models = require('./models/models');
        Purchase = models.Purchase;
        User = models.User;
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function checkServerRunning() {
    try {
        console.log('🔍 Checking if server is running...');
        const response = await axios.get(`${BASE_URL}/`, { timeout: 3000 });
        console.log('✅ Server is running');
        return true;
    } catch (error) {
        console.error('❌ Server is not running. Please start the server first:');
        console.error('   npm start  or  node index.js');
        return false;
    }
}

const testData = {
    amount: '562.5', // BGMI price
    customerName: 'Test User Complete Flow',
    customerEmail: 'test.complete.flow@example.com',
    customerPhone: '9999999999',
    items: [{
        id: 1,
        title: 'BGMI TOURNAMENT',
        price: '₹562.5',
        itemName: 'BGMI TOURNAMENT',
        type: 'event',
        quantity: 1
    }],
    visitorPassDays: 0,
    visitorPassDetails: {},
    formDataBySignature: {
        'solo_events_1': {
            name: 'Test User Complete Flow',
            collegeMailId: 'test.complete.flow@example.com',
            contactNo: '9999999999',
            gender: 'male',
            age: '22',
            universityName: 'Test University',
            address: 'Test Address'
        }
    },
    teamMembersBySignature: {},
    flagshipBenefitsByEvent: {},
    promoCode: null,
    appliedDiscount: 0,
    metadata: {
        totalPrice: 562.5,
        finalPrice: 562.5,
        timestamp: new Date().toISOString(),
        source: 'test-complete-flow'
    }
};

async function testCompletePaymentFlow() {
    console.log('🚀 Testing Complete Payment Flow');
    console.log('=====================================\n');

    // Check prerequisites first
    const dbConnected = await connectToMongoDB();
    if (!dbConnected) {
        throw new Error('Cannot connect to MongoDB. Please check your database connection.');
    }
    
    const serverRunning = await checkServerRunning();
    if (!serverRunning) {
        throw new Error('Backend server is not running. Please start the server first.');
    }

    try {
        // Step 1: Clean up any existing test data
        console.log('🧹 Cleaning up existing test data...');
        await User.deleteMany({ email: testData.customerEmail });
        await Purchase.deleteMany({ 'userDetails.email': testData.customerEmail });
        console.log('✅ Cleanup completed\n');

        // Step 2: Create payment order (simulating frontend)
        console.log('💳 Step 1: Creating payment order...');
        const orderResponse = await axios.post(`${BASE_URL}/api/payments/create-order`, testData, {
            timeout: 10000
        });

        if (!orderResponse.data.success) {
            throw new Error(`Order creation failed: ${orderResponse.data.message}`);
        }

        const orderId = orderResponse.data.data.order_id;
        console.log(`✅ Order created successfully: ${orderId}`);
        console.log(`   Payment Session ID: ${orderResponse.data.data.payment_session_id}`);

        // Step 3: Verify purchase record was created with correct items
        console.log('\n🔍 Step 2: Verifying purchase record...');
        const purchase = await Purchase.findOne({ orderId: orderId });
        
        if (!purchase) {
            throw new Error('Purchase record not found');
        }

        console.log(`✅ Purchase record found`);
        console.log(`   Items count: ${purchase.items.length}`);
        console.log(`   Items: ${purchase.items.map(item => item.itemName || item.title).join(', ')}`);
        console.log(`   User Details Email: ${purchase.userDetails.email}`);
        console.log(`   Payment Status: ${purchase.paymentStatus}`);

        if (purchase.items.length === 0) {
            throw new Error('❌ CRITICAL: Purchase has empty items array!');
        }

        if (!purchase.items.some(item => (item.itemName || item.title) === 'BGMI TOURNAMENT')) {
            throw new Error('❌ CRITICAL: BGMI TOURNAMENT not found in purchase items!');
        }

        // Step 4: Simulate successful payment webhook
        console.log('\n🎉 Step 3: Simulating successful payment webhook...');
        const webhookData = {
            data: {
                order: {
                    order_id: orderId,
                    order_amount: testData.amount
                },
                payment: {
                    payment_status: 'SUCCESS',
                    payment_method: 'upi',
                    cf_payment_id: `test_payment_${Date.now()}`
                }
            }
        };

        const webhookResponse = await axios.post(`${BASE_URL}/api/payments/webhook`, webhookData, {
            timeout: 15000 // Allow more time for processing
        });

        if (webhookResponse.status !== 200) {
            throw new Error(`Webhook processing failed: ${webhookResponse.status}`);
        }

        console.log('✅ Webhook processed successfully');

        // Step 5: Verify user was created with correct events
        console.log('\n👤 Step 4: Verifying user registration...');
        
        // Wait a moment for async processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const user = await User.findOne({ email: testData.customerEmail });
        
        if (!user) {
            throw new Error('❌ CRITICAL: User was not created!');
        }

        console.log(`✅ User created successfully: ${user._id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Events count: ${user.events ? user.events.length : 0}`);
        console.log(`   Events: ${user.events ? user.events.join(', ') : 'EMPTY!'}`);
        console.log(`   Is Validated: ${user.isvalidated}`);
        console.log(`   QR Path: ${user.qrPath || 'Not generated'}`);

        // Step 6: Critical verification - events array should not be empty
        if (!user.events || user.events.length === 0) {
            throw new Error('❌ CRITICAL ISSUE FOUND: User has EMPTY events array despite successful payment!');
        }

        if (!user.events.includes('BGMI TOURNAMENT')) {
            throw new Error('❌ CRITICAL ISSUE FOUND: User events array does not contain BGMI TOURNAMENT!');
        }

        // Step 7: Verify purchase was updated
        console.log('\n📋 Step 5: Verifying purchase completion...');
        const updatedPurchase = await Purchase.findOne({ orderId: orderId });
        
        console.log(`   Payment Status: ${updatedPurchase.paymentStatus}`);
        console.log(`   User Registered: ${updatedPurchase.userRegistered}`);
        console.log(`   QR Generated: ${updatedPurchase.qrGenerated}`);
        console.log(`   Email Sent: ${updatedPurchase.emailSent}`);

        if (updatedPurchase.paymentStatus !== 'completed') {
            console.warn('⚠️ Warning: Purchase payment status is not "completed"');
        }

        console.log('\n🎉 SUCCESS: Complete payment flow test passed!');
        console.log('✅ User created with correct events array');
        console.log('✅ No more empty events arrays despite QR code generation');
        console.log('✅ Frontend data properly received and processed');

        return {
            success: true,
            orderId: orderId,
            userId: user._id,
            userEvents: user.events
        };

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR in payment flow test:');
        console.error(error.message);
        console.error('\nThis indicates the issue with empty events arrays is NOT fixed!');
        
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    try {
        const result = await testCompletePaymentFlow();
        
        console.log('\n=====================================');
        console.log('📊 TEST RESULTS:');
        
        if (result.success) {
            console.log('✅ ALL TESTS PASSED');
            console.log('✅ Empty events array issue appears to be FIXED');
            console.log(`✅ Order ID: ${result.orderId}`);
            console.log(`✅ User ID: ${result.userId}`);
            console.log(`✅ User Events: ${result.userEvents.join(', ')}`);
        } else {
            console.log('❌ TESTS FAILED');
            console.log('❌ Empty events array issue is NOT fixed');
            console.log(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.log('\n=====================================');
        console.log('📊 TEST RESULTS:');
        console.log('❌ TESTS FAILED');
        console.log('❌ Empty events array issue is NOT fixed');
        console.log(`❌ Error: ${error.message}`);
    } finally {
        // Close MongoDB connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 MongoDB connection closed');
        }
        process.exit(0);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testCompletePaymentFlow };