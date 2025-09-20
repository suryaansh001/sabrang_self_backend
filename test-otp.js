const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testOTPFlow() {
    console.log('🧪 Testing OTP Flow...\n');
    
    // Test email - make sure this email exists in your database
    const testEmail = 'suryaanshsharma@gmail.com'; // Replace with actual registered email
    
    try {
        console.log('1️⃣ Sending OTP...');
        const otpResponse = await axios.post(`${BASE_URL}/api/send-ticket-otp`, {
            email: testEmail
        });
        
        console.log('✅ OTP Response:', otpResponse.data);
        
        // In a real scenario, user would get OTP from email
        // For testing, we'll need to check server logs or enter manually
        console.log('\n📧 Check your email for the OTP');
        console.log('💡 For testing, check server console logs for the OTP');
        
        // Simulate OTP verification (you'll need to replace with actual OTP)
        const testOTP = '123456'; // Replace with actual OTP from logs/email
        
        console.log('\n2️⃣ Verifying OTP (using test OTP, replace with real one)...');
        // Note: This will fail unless you use the real OTP
        try {
            const verifyResponse = await axios.post(`${BASE_URL}/api/verify-ticket-otp`, {
                email: testEmail,
                otp: testOTP
            });
            
            console.log('✅ Verify Response:', verifyResponse.data);
            
            // Test fetching team data with access token
            console.log('\n3️⃣ Fetching team data...');
            const teamResponse = await axios.post(`${BASE_URL}/api/team-by-email`, {
                accessToken: verifyResponse.data.accessToken
            });
            
            console.log('✅ Team Data Response:', teamResponse.data);
            
        } catch (verifyError) {
            console.log('❌ OTP Verification failed (expected with test OTP):', verifyError.response?.data);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Run the test
testOTPFlow();
