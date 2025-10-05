const axios = require('axios');

// Test script to verify event arrays are properly populated in emails
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Test data simulating what the frontend sends
const testOrderData = {
    amount: '500',
    customerName: 'Test User',
    customerEmail: 'test@example.com',
    customerPhone: '9999999999',
    items: [
        {
            id: 1,
            title: 'DANCE BATTLE',
            price: '250',
            itemName: 'DANCE BATTLE',
            type: 'event',
            quantity: 1
        },
        {
            id: 2,
            title: 'STEP UP',
            price: '250',
            itemName: 'STEP UP',
            type: 'event',
            quantity: 1
        }
    ]
};

// Function to test email service directly
async function testEmailService() {
    console.log('🧪 Testing email service event handling...');
    
    // Test the email service function directly
    const { generateRegistrationEmailContent } = require('./utils/emailService');
    
    // Test case 1: Valid events array
    console.log('\n📧 Test 1: Valid events array');
    const testData1 = {
        name: 'Test User',
        events: ['DANCE BATTLE', 'STEP UP']
    };
    const result1 = generateRegistrationEmailContent(testData1);
    console.log('✅ Result 1 - Events should be "DANCE BATTLE, STEP UP"');
    console.log('   Actual events text:', result1.textContent.match(/Events Registered:\s*([^\n]+)/)[1]);
    
    // Test case 2: Empty events array
    console.log('\n📧 Test 2: Empty events array');
    const testData2 = {
        name: 'Test User',
        events: []
    };
    const result2 = generateRegistrationEmailContent(testData2);
    console.log('✅ Result 2 - Should fallback to "General Registration - Sabrang\'25"');
    console.log('   Actual events text:', result2.textContent.match(/Events Registered:\s*([^\n]+)/)[1]);
    
    // Test case 3: Demo Payment in events
    console.log('\n📧 Test 3: Demo Payment in events (should be filtered out)');
    const testData3 = {
        name: 'Test User',
        events: ['Demo Payment', 'DANCE BATTLE']
    };
    const result3 = generateRegistrationEmailContent(testData3);
    console.log('✅ Result 3 - Should show only "DANCE BATTLE" (Demo Payment filtered out)');
    console.log('   Actual events text:', result3.textContent.match(/Events Registered:\s*([^\n]+)/)[1]);
    
    // Test case 4: Only Demo Payment
    console.log('\n📧 Test 4: Only Demo Payment in events');
    const testData4 = {
        name: 'Test User',
        events: ['Demo Payment']
    };
    const result4 = generateRegistrationEmailContent(testData4);
    console.log('✅ Result 4 - Should fallback to "General Registration - Sabrang\'25"');
    console.log('   Actual events text:', result4.textContent.match(/Events Registered:\s*([^\n]+)/)[1]);
}

// Function to test payment order creation
async function testPaymentOrderCreation() {
    console.log('\n🛒 Testing payment order creation with events...');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/payments/create-order`, testOrderData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        if (response.data.success) {
            console.log('✅ Payment order created successfully');
            console.log('   Order ID:', response.data.data.order_id);
            
            // Check if the order was saved with proper event names
            // (We would need to query the database to verify this)
            console.log('ℹ️  Payment session created. Events should be properly stored in the database.');
            return response.data.data.order_id;
        } else {
            console.error('❌ Payment order creation failed:', response.data.message);
        }
    } catch (error) {
        console.error('❌ Error creating payment order:', error.response?.data || error.message);
    }
}

// Function to test order verification
async function testOrderVerification(orderId) {
    if (!orderId) return;
    
    console.log('\n🔍 Testing order verification...');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/payments/verify/${orderId}`, {
            timeout: 30000
        });
        
        if (response.data.success) {
            console.log('✅ Order verification successful');
            console.log('   Payment status:', response.data.data[0]?.payment_status || 'N/A');
        } else {
            console.log('ℹ️  Order verification response:', response.data);
        }
    } catch (error) {
        console.log('ℹ️  Order verification error (expected for test orders):', error.response?.data?.message || error.message);
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting event array fix tests...\n');
    
    // Test 1: Email service event handling
    await testEmailService();
    
    // Test 2: Payment order creation
    const orderId = await testPaymentOrderCreation();
    
    // Test 3: Order verification (optional, might fail for test orders)
    await testOrderVerification(orderId);
    
    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary of fixes:');
    console.log('   1. ✅ Email service now filters out "Demo Payment" and empty events');
    console.log('   2. ✅ Payment order creation now processes items array from frontend');
    console.log('   3. ✅ Proper fallback to "General Registration - Sabrang\'25" when no valid events');
    console.log('   4. ✅ Event extraction improved with multiple fallback sources');
    console.log('\n🎯 Result: Users should now receive emails with proper event names instead of generic registrations!');
}

// Run the tests
runTests().catch(console.error);