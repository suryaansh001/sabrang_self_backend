require('dotenv').config();
const { Cashfree, CFEnvironment } = require('cashfree-pg');

// Test Cashfree integration
async function testCashfreeIntegration() {
  console.log('🧪 Testing Cashfree Payment Integration...\n');

  // Initialize Cashfree
  const cashfree = new Cashfree(
    CFEnvironment.PRODUCTION,
    process.env.CASHFREE_APP_ID,
    process.env.CASHFREE_SECRET_KEY
  );

  console.log('🔧 Configuration:');
  console.log('- Environment: PRODUCTION');
  console.log('- App ID:', process.env.CASHFREE_APP_ID?.substring(0, 10) + '...');
  console.log('- Has Secret Key:', !!process.env.CASHFREE_SECRET_KEY);
  console.log('');

  // Test order creation
  const orderRequest = {
    order_amount: 1.00,
    order_currency: 'INR',
    order_id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    customer_details: {
      customer_id: `test_customer_${Date.now()}`,
      customer_phone: '9876543210',
      customer_name: 'Test User',
      customer_email: 'test@cashfree.com'
    },
    order_meta: {
      return_url: 'https://sabrang25-first-draft.vercel.app/payment-success',
      payment_methods: 'cc,dc,upi,nb,app,paylater'
    }
  };

  try {
    console.log('📤 Creating test order...');
    console.log('Order Request:', JSON.stringify(orderRequest, null, 2));
    console.log('');

    const response = await cashfree.PGCreateOrder(orderRequest);
    
    console.log('✅ ORDER CREATED SUCCESSFULLY!');
    console.log('Order ID:', response.data.order_id);
    console.log('CF Order ID:', response.data.cf_order_id);
    console.log('Payment Session ID:', response.data.payment_session_id);
    console.log('Order Status:', response.data.order_status);
    console.log('Order Amount:', response.data.order_amount);
    console.log('');

    console.log('🎯 NEXT STEPS:');
    console.log('1. Use this Payment Session ID in your frontend:');
    console.log(`   ${response.data.payment_session_id}`);
    console.log('');
    console.log('2. For testing, whitelist these domains in Cashfree Dashboard:');
    console.log('   - https://sabrang25-first-draft.vercel.app');
    console.log('   - http://localhost:3000');
    console.log('');
    console.log('3. Whitelisting URL: https://merchant.cashfree.com/');

  } catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
    
    if (error.response?.data?.code === 'order_meta.payment_methods_invalid') {
      console.log('\n💡 TIP: Invalid payment methods. Use: cc,dc,ppc,ccc,emi,paypal,upi,nb,app,paylater');
    }
  }
}

// Run the test
testCashfreeIntegration().catch(console.error);
