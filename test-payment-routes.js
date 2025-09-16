#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://surprising-balance-production.up.railway.app';
const API_BASE = `${BASE_URL}/api/payment`;

// Test data
const testUserDetails = {
  name: "Test User",
  email: "test@example.com",
  contactNo: "9999999999",
  gender: "Other",
  age: 22,
  universityName: "Test University",
  address: "Test Address"
};

const testItems = [
  {
    eventId: "test_event_1",
    eventName: "Test Event 1",
    price: 100
  }
];

const testPromoCode = {
  code: "TEST10",
  discountAmount: 10
};

// Helper functions
const log = {
  info: (msg) => console.log(chalk.blue('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✅'), msg),
  error: (msg) => console.log(chalk.red('❌'), msg),
  warn: (msg) => console.log(chalk.yellow('⚠️'), msg),
  title: (msg) => console.log(chalk.cyan.bold(`\n🧪 ${msg}\n${'='.repeat(60)}`))
};

const makeRequest = async (method, endpoint, data = null) => {
  try {
    const url = `${API_BASE}${endpoint}`;
    log.info(`Making ${method.toUpperCase()} request to: ${url}`);
    
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      config.data = data;
      log.info(`Request data: ${JSON.stringify(data, null, 2)}`);
    }
    
    const response = await axios(config);
    log.success(`Status: ${response.status}`);
    log.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    if (error.response) {
      log.error(`Status: ${error.response.status}`);
      log.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
      return { success: false, error: error.response.data, status: error.response.status };
    } else {
      log.error(`Network Error: ${error.message}`);
      return { success: false, error: error.message, status: 'NETWORK_ERROR' };
    }
  }
};

// Test functions
const testValidatePromo = async () => {
  log.title('Testing Promo Code Validation');
  
  // Test valid promo code
  log.info('Testing valid promo code...');
  await makeRequest('POST', '/validate-promo', {
    code: 'WELCOME25',
    totalAmount: 500
  });
  
  // Test invalid promo code
  log.info('Testing invalid promo code...');
  await makeRequest('POST', '/validate-promo', {
    code: 'INVALID',
    totalAmount: 500
  });
};

const testCreateSession = async () => {
  log.title('Testing Create Session Endpoint');
  
  const result = await makeRequest('POST', '/create-session', {
    userDetails: testUserDetails,
    items: testItems,
    totalAmount: 100,
    promoCode: null,
    metadata: { source: 'test' }
  });
  
  return result;
};

const testCreateOrder = async () => {
  log.title('Testing Create Order Endpoint');
  
  const result = await makeRequest('POST', '/create-order', {
    userDetails: testUserDetails,
    items: testItems,
    totalAmount: 100,
    promoCode: null,
    metadata: { source: 'test' }
  });
  
  return result;
};

const testFetchPayments = async (orderId) => {
  log.title('Testing Fetch Payments Endpoint');
  
  if (!orderId) {
    log.warn('No order ID provided, using test order ID');
    orderId = 'SABRANG_test_123';
  }
  
  await makeRequest('GET', `/fetch-payments/${orderId}`);
};

const testVerifyPayment = async (orderId) => {
  log.title('Testing Verify Payment Endpoint');
  
  if (!orderId) {
    log.warn('No order ID provided, using test order ID');
    orderId = 'SABRANG_test_123';
  }
  
  await makeRequest('POST', '/verify-payment', {
    orderId: orderId,
    paymentId: 'test_payment_id'
  });
};

const testWebhook = async () => {
  log.title('Testing Webhook Endpoint');
  
  await makeRequest('POST', '/webhook', {
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: {
        order_id: 'SABRANG_test_123'
      },
      payment: {
        payment_status: 'SUCCESS',
        payment_amount: 100
      }
    }
  });
};

const testPaymentStatus = async (orderId) => {
  log.title('Testing Payment Status Endpoint');
  
  if (!orderId) {
    log.warn('No order ID provided, using test order ID');
    orderId = 'SABRANG_test_123';
  }
  
  await makeRequest('GET', `/status/${orderId}`);
};

const testHealthCheck = async () => {
  log.title('Testing Health Check');
  
  try {
    const response = await axios.get(BASE_URL);
    log.success(`Server is running - Status: ${response.status}`);
    return true;
  } catch (error) {
    log.error(`Server health check failed: ${error.message}`);
    return false;
  }
};

const runAllTests = async () => {
  console.log(chalk.magenta.bold(`
🚀 Payment Routes Test Suite
======================================
Base URL: ${BASE_URL}
API Base: ${API_BASE}
======================================
  `));
  
  // Health check first
  const serverHealthy = await testHealthCheck();
  if (!serverHealthy) {
    log.error('Server is not responding. Aborting tests.');
    process.exit(1);
  }
  
  let orderId = null;
  
  try {
    // Test all routes
    await testValidatePromo();
    
    // Test create session and get order ID
    const sessionResult = await testCreateSession();
    if (sessionResult.success && sessionResult.data.data) {
      orderId = sessionResult.data.data.orderId;
      log.success(`Got order ID from create-session: ${orderId}`);
    }
    
    // Test create order (should also work)
    await testCreateOrder();
    
    // Test other endpoints with the order ID
    await testFetchPayments(orderId);
    await testVerifyPayment(orderId);
    await testPaymentStatus(orderId);
    await testWebhook();
    
    log.title('Test Summary');
    log.success('All tests completed! Check the results above.');
    log.info('Note: Some endpoints may fail if Cashfree credentials are not properly configured.');
    
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
};

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'health':
    testHealthCheck();
    break;
  case 'promo':
    testValidatePromo();
    break;
  case 'create-session':
    testCreateSession();
    break;
  case 'create-order':
    testCreateOrder();
    break;
  case 'fetch':
    testFetchPayments(process.argv[3]);
    break;
  case 'verify':
    testVerifyPayment(process.argv[3]);
    break;
  case 'webhook':
    testWebhook();
    break;
  case 'status':
    testPaymentStatus(process.argv[3]);
    break;
  case 'all':
  default:
    runAllTests();
    break;
}
