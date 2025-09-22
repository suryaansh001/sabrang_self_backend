#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testPaymentInitialization() {
    console.log('🧪 Testing Payment Initialization Flow');
    console.log('=====================================\n');

    try {
        // Test 1: Registration (should work without payment verification)
        console.log('1️⃣ Testing Registration Endpoint');
        const registrationData = {
            name: 'Test User Payment Init',
            email: 'test.payment.init@example.com',
            contactNo: '9999999999',
            collegeName: 'Test College',
            course: 'Test Course',
            year: '2nd',
            referralCode: 'TESTREF'
        };

        try {
            const regResponse = await axios.post(`${BASE_URL}/register`, registrationData, {
                timeout: 10000
            });
            
            if (regResponse.status === 200 || regResponse.status === 201) {
                console.log('✅ Registration successful');
                console.log('   Response:', regResponse.data.message || 'Registration completed');
            } else {
                console.log('❌ Registration failed with status:', regResponse.status);
                return;
            }
        } catch (regError) {
            console.log('❌ Registration failed:', regError.response?.data?.message || regError.message);
            return;
        }

        console.log('');

        // Test 2: Payment Order Creation (should work now)
        console.log('2️⃣ Testing Payment Order Creation');
        const paymentData = {
            customerName: 'Test User Payment Init',
            customerEmail: 'test.payment.init@example.com', 
            customerPhone: '9999999999',
            amount: '10',
            referralCode: 'TESTREF'
        };

        try {
            const paymentResponse = await axios.post(`${BASE_URL}/cashfree/create-order`, paymentData, {
                timeout: 15000
            });
            
            if (paymentResponse.status === 200) {
                console.log('✅ Payment order creation successful');
                console.log('   Order ID:', paymentResponse.data.order_id);
                console.log('   Payment Session ID:', paymentResponse.data.payment_session_id);
                console.log('   Payment URL:', paymentResponse.data.payment_link || 'Not provided');
            } else {
                console.log('❌ Payment order creation failed with status:', paymentResponse.status);
            }
        } catch (paymentError) {
            console.log('❌ Payment order creation failed:');
            console.log('   Error:', paymentError.response?.data?.error || paymentError.message);
            if (paymentError.response?.data?.details) {
                console.log('   Details:', paymentError.response.data.details);
            }
        }

        console.log('');

        // Test 3: QR Code Access (should fail without payment)
        console.log('3️⃣ Testing QR Code Access (should fail without payment)');
        try {
            const qrResponse = await axios.get(`${BASE_URL}/api/qrcode/test.payment.init@example.com`, {
                timeout: 5000
            });
            
            if (qrResponse.status === 200) {
                console.log('❌ QR Code accessible without payment (SECURITY ISSUE)');
            }
        } catch (qrError) {
            if (qrError.response?.status === 402 || qrError.response?.status === 403) {
                console.log('✅ QR Code properly blocked without payment');
                console.log('   Message:', qrError.response.data.message || 'Payment required');
            } else {
                console.log('⚠️  QR Code access failed with unexpected error:', qrError.response?.status || qrError.message);
            }
        }

    } catch (error) {
        console.log('❌ Test suite failed:', error.message);
    }

    console.log('\n🏁 Payment initialization test completed');
}

// Run the test
if (require.main === module) {
    testPaymentInitialization().catch(console.error);
}

module.exports = { testPaymentInitialization };
