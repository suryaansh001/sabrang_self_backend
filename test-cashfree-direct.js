const axios = require('axios');
require('dotenv').config();

console.log('🧪 Testing Cashfree Integration with Direct API');

// Test order creation using direct HTTP API calls
async function testOrderCreationDirect() {
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

    const response = await axios.post('https://api.cashfree.com/pg/orders', request, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'x-api-version': '2022-09-01'
      }
    });
    
    console.log('✅ Order created successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('API Status:', error.response.status);
      console.error('API Headers:', error.response.headers);
    }
  }
}

// Run the test
testOrderCreationDirect();
