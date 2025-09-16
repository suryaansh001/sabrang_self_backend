const { Cashfree, CFEnvironment } = require('cashfree-pg');
require('dotenv').config();

console.log('🧪 Testing Cashfree Integration');

// Use production since credentials are production
const cashfreeEnvironment = CFEnvironment.PRODUCTION;
console.log(`🔧 Environment: PRODUCTION (using production credentials)`);
console.log(`🔑 App ID: ${process.env.CASHFREE_APP_ID}`);
console.log(`🔑 Secret: ${process.env.CASHFREE_SECRET_KEY ? 'SET' : 'NOT SET'}`);

const cashfree = new Cashfree(
  cashfreeEnvironment, 
  process.env.CASHFREE_APP_ID, 
  process.env.CASHFREE_SECRET_KEY
);

// Test order creation with the exact format from the documentation
async function testOrderCreation() {
  try {
    const request = {
      "order_amount": 1,
      "order_currency": "INR",
      "customer_details": {
        "customer_id": "node_sdk_test",
        "customer_email": "example@gmail.com",
        "customer_phone": "9999999999"
      },
      "order_meta": {
        "return_url": "https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}"
      }
    };

    console.log('📤 Creating test order...');
    console.log('Request:', JSON.stringify(request, null, 2));

    const response = await cashfree.PGCreateOrder("2022-09-01", request);
    
    console.log('✅ Order created successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('API Status:', error.response.status);
    }
  }
}

// Run the test
testOrderCreation();
