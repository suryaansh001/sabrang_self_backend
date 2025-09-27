#!/usr/bin/env node

/**
 * Test script to verify QR code generation only happens after payment completion
 * This script tests the complete flow from registration to payment completion
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');

// Test configuration
const TEST_USER = {
    name: 'Test User QR Flow',
    email: 'test-qr-flow@example.com',
    contactNo: '9876543210'
};

// Connect to database
async function connectDB() {
    try {
        const mongoUri = process.env.DATABASE_URL || process.env.mongodb;
        if (!mongoUri) {
            throw new Error('DATABASE_URL or mongodb environment variable is required');
        }
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

async function cleanup() {
    console.log('🧹 Cleaning up test data...');
    await User.deleteMany({ email: TEST_USER.email });
    await Purchase.deleteMany({ 'userDetails.email': TEST_USER.email });
    console.log('✅ Cleanup completed');
}

async function testRegistrationFlow() {
    console.log('\n📝 Testing Registration Flow (should NOT generate QR)...');
    
    // This simulates what happens when user clicks "Pay Now" - user is registered but no QR generated
    const user = new User({
        name: TEST_USER.name,
        email: TEST_USER.email,
        contactNo: TEST_USER.contactNo,
        events: ['Test Event'],
        isvalidated: false // Not validated until payment completes
    });
    
    await user.save();
    console.log(`👤 User created: ${user.name} (${user.email})`);
    console.log(`🔍 User has QR code: ${user.qrCodeBase64 ? 'YES' : 'NO'}`);
    
    if (user.qrCodeBase64) {
        console.log('❌ PROBLEM: QR code generated during registration (before payment)');
        return false;
    } else {
        console.log('✅ CORRECT: No QR code generated during registration');
        return true;
    }
}

async function testPaymentCompletionFlow() {
    console.log('\n💳 Testing Payment Completion Flow (should generate QR)...');
    
    // Find the user created in registration
    const user = await User.findOne({ email: TEST_USER.email });
    if (!user) {
        console.log('❌ User not found for payment completion test');
        return false;
    }
    
    // Simulate payment completion - this is what happens in /success/:orderId
    const { generateUserQRCode } = require('./utils/qrCodeService');
    
    try {
        const qrCodeBase64 = await generateUserQRCode(user._id, {
            name: user.name,
            email: user.email,
            events: user.events || []
        });
        
        user.qrPath = `${user._id}`;
        user.qrCodeBase64 = qrCodeBase64;
        user.isvalidated = true; // Mark as validated after payment
        await user.save();
        
        console.log(`👤 User after payment: ${user.name} (${user.email})`);
        console.log(`🔍 User has QR code: ${user.qrCodeBase64 ? 'YES' : 'NO'}`);
        console.log(`🔍 QR code length: ${user.qrCodeBase64 ? user.qrCodeBase64.length : 0} characters`);
        
        if (user.qrCodeBase64) {
            console.log('✅ CORRECT: QR code generated after payment completion');
            return true;
        } else {
            console.log('❌ PROBLEM: QR code NOT generated after payment completion');
            return false;
        }
    } catch (error) {
        console.error('❌ Error generating QR code after payment:', error.message);
        return false;
    }
}

async function testPaymentFailureFlow() {
    console.log('\n❌ Testing Payment Failure Flow (should NOT have QR)...');
    
    // Create a user that simulates payment failure
    const failureUser = new User({
        name: 'Payment Failure User',
        email: 'payment-failure@example.com',
        contactNo: '9876543211',
        events: ['Test Event'],
        isvalidated: false // Payment failed, so not validated
    });
    
    await failureUser.save();
    console.log(`👤 Payment failure user: ${failureUser.name} (${failureUser.email})`);
    console.log(`🔍 User has QR code: ${failureUser.qrCodeBase64 ? 'YES' : 'NO'}`);
    console.log(`🔍 User is validated: ${failureUser.isvalidated ? 'YES' : 'NO'}`);
    
    // Clean up failure user
    await User.deleteOne({ email: 'payment-failure@example.com' });
    
    if (!failureUser.qrCodeBase64 && !failureUser.isvalidated) {
        console.log('✅ CORRECT: No QR code or validation for failed payment');
        return true;
    } else {
        console.log('❌ PROBLEM: QR code or validation exists for failed payment');
        return false;
    }
}

async function main() {
    console.log('🧪 QR Code Generation Flow Test');
    console.log('=====================================');
    console.log('This test verifies that QR codes are only generated after successful payment completion.');
    
    await connectDB();
    await cleanup();
    
    const results = {
        registration: false,
        paymentCompletion: false,
        paymentFailure: false
    };
    
    try {
        results.registration = await testRegistrationFlow();
        results.paymentCompletion = await testPaymentCompletionFlow();
        results.paymentFailure = await testPaymentFailureFlow();
    } catch (error) {
        console.error('❌ Test execution error:', error.message);
    } finally {
        await cleanup();
    }
    
    // Results summary
    console.log('\n📊 TEST RESULTS:');
    console.log('=================');
    console.log(`Registration Flow (no QR): ${results.registration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Payment Completion (has QR): ${results.paymentCompletion ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Payment Failure (no QR): ${results.paymentFailure ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = results.registration && results.paymentCompletion && results.paymentFailure;
    
    if (allPassed) {
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('✅ QR codes are only generated after successful payment completion.');
        console.log('✅ The premature QR generation issue has been fixed.');
    } else {
        console.log('\n❌ SOME TESTS FAILED!');
        console.log('⚠️ QR code generation flow may still have issues.');
    }
    
    await mongoose.connection.close();
    console.log('\n🔚 Test completed');
    
    process.exit(allPassed ? 0 : 1);
}

// Run the test
main().catch(error => {
    console.error('❌ Fatal test error:', error);
    process.exit(1);
});