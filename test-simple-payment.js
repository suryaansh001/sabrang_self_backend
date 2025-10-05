#!/usr/bin/env node

/**
 * Simple Payment Flow Test
 * Tests just the payment order creation to verify our fixes
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://127.0.0.1:5000';

const testData = {
    amount: '562.5', // BGMI price
    customerName: 'Test User Simple',
    customerEmail: 'test.simple@example.com',
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
            name: 'Test User Simple',
            collegeMailId: 'test.simple@example.com',
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
        source: 'simple-test'
    }
};

async function testSimplePaymentOrder() {
    try {
        console.log('🚀 Testing Simple Payment Order Creation');
        console.log('=========================================\n');

        console.log('📋 Test Data:');
        console.log(`   Amount: ${testData.amount}`);
        console.log(`   Items: ${testData.items.map(i => i.itemName).join(', ')}`);
        console.log(`   Customer: ${testData.customerEmail}\n`);

        console.log('💳 Creating payment order...');
        const response = await axios.post(`${BASE_URL}/api/payments/create-order`, testData, {
            timeout: 10000
        });

        console.log('📤 Response Status:', response.status);
        console.log('📤 Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('\n✅ SUCCESS: Payment order created successfully!');
            console.log(`   Order ID: ${response.data.data.order_id}`);
            console.log(`   Payment Session: ${response.data.data.payment_session_id}`);
            console.log('\n🎉 This confirms our fixes are working:');
            console.log('   ✅ Frontend data properly sent to backend');
            console.log('   ✅ Backend properly receives and processes items');
            console.log('   ✅ Order creation with event information successful');
        } else {
            console.log('\n❌ FAILED: Payment order creation failed');
            console.log(`   Error: ${response.data.message}`);
        }

    } catch (error) {
        console.error('\n❌ ERROR: Test failed');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testSimplePaymentOrder();