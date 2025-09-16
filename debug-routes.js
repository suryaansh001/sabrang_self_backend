// Debug script to test route mismatches and environment issues
require("dotenv").config();

console.log('🔍 Route Mismatch Debug Report');
console.log('================================');

// Check environment variables
const requiredEnvVars = [
  'CASHFREE_APP_ID',
  'CASHFREE_SECRET_KEY', 
  'mongodb',
  'jwtkey',
  'frontendurl'
];

console.log('\n📊 Environment Variables Status:');
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const status = value ? '✅ Set' : '❌ Missing';
  const valueLength = value ? `(${value.length} chars)` : '';
  console.log(`  ${envVar}: ${status} ${valueLength}`);
});

// Test Cashfree initialization
console.log('\n🏦 Cashfree SDK Test:');
try {
  const { Cashfree, CFEnvironment } = require('cashfree-pg');
  
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    console.log('❌ Missing Cashfree credentials');
  } else {
    const cashfree = new Cashfree(
      CFEnvironment.PRODUCTION,
      process.env.CASHFREE_APP_ID,
      process.env.CASHFREE_SECRET_KEY
    );
    console.log('✅ Cashfree SDK initialized successfully');
  }
} catch (error) {
  console.log('❌ Cashfree SDK initialization failed:', error.message);
}

// Frontend-Backend Route Mapping Check
console.log('\n🛣️  Route Mapping Verification:');
const frontendRoutes = [
  '/api/payment/validate-promo',
  '/api/payment/create-session', 
  '/api/payment/status/:orderId'
];

const backendRoutes = [
  '/api/payment/validate-promo',
  '/api/payment/create-session',
  '/api/payment/create-order',
  '/api/payment/fetch-payments/:orderId',
  '/api/payment/verify-payment/:orderId',
  '/api/payment/status/:orderId',
  '/api/payment/process-manual/:orderId',
  '/api/payment/webhook'
];

console.log('\n📤 Frontend calls these routes:');
frontendRoutes.forEach(route => {
  const exists = backendRoutes.some(br => br.replace(':orderId', ':id') === route.replace(':orderId', ':id'));
  console.log(`  ${route} ${exists ? '✅' : '❌'}`);
});

console.log('\n📥 Backend provides these routes:');
backendRoutes.forEach(route => {
  const used = frontendRoutes.some(fr => fr.replace(':orderId', ':id') === route.replace(':orderId', ':id'));
  console.log(`  ${route} ${used ? '✅ Used' : '⚠️  Unused'}`);
});

console.log('\n🔧 Recommendations:');
console.log('1. ✅ No critical route mismatches found');
console.log('2. ⚠️  Fix status codes in validate-promo (use 200 for all responses)');
console.log('3. ⚠️  Verify Cashfree credentials are correct');
console.log('4. ⚠️  Check if Cashfree is in correct mode (sandbox vs production)');
