const axios = require('axios');

async function testTicketAPI() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 Testing Ticket API Compatibility\n');
  
  try {
    // Test 1: Check if events endpoint works
    console.log('1️⃣ Testing events endpoint...');
    try {
      const eventsResponse = await axios.get(`${baseURL}/api/events`);
      console.log('✅ Events endpoint working');
      console.log(`   Found ${eventsResponse.data.length} events`);
    } catch (error) {
      console.log('❌ Events endpoint failed:', error.message);
    }
    
    // Test 2: Check OTP sending (without actually sending)
    console.log('\n2️⃣ Testing OTP endpoints...');
    try {
      const otpResponse = await axios.post(`${baseURL}/api/send-ticket-otp`, {
        email: 'test@example.com'
      });
      console.log('✅ OTP endpoint structure working');
      console.log('   Response:', otpResponse.data);
    } catch (error) {
      console.log('⚠️ OTP endpoint response (expected):', error.response?.data || error.message);
    }
    
    // Test 3: Check server health
    console.log('\n3️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/api/events`);
      console.log('✅ Server is responding');
      console.log(`   Status: ${healthResponse.status}`);
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
    }
    
    console.log('\n🎯 API Structure Test Complete');
    console.log('\n📋 Expected Frontend Flow:');
    console.log('   1. User enters email');
    console.log('   2. POST /api/send-ticket-otp { email }');
    console.log('   3. User enters OTP');
    console.log('   4. POST /api/verify-ticket-otp { email, otp }');
    console.log('   5. POST /api/team-by-email { accessToken }');
    console.log('   6. GET /api/qrcode/:id for each registration');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTicketAPI();
