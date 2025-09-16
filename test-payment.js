require('dotenv').config();

console.log('🔍 Environment Variables Check:');
console.log('mongodb:', !!process.env.mongodb ? '✅ Set' : '❌ Missing');
console.log('jwtkey:', !!process.env.jwtkey ? '✅ Set' : '❌ Missing');
console.log('CASHFREE_APP_ID:', !!process.env.CASHFREE_APP_ID ? '✅ Set' : '❌ Missing');
console.log('CASHFREE_SECRET_KEY:', !!process.env.CASHFREE_SECRET_KEY ? '✅ Set' : '❌ Missing');
console.log('frontendurl:', !!process.env.frontendurl ? '✅ Set' : '❌ Missing');
console.log('BACKEND_URL:', !!process.env.BACKEND_URL ? '✅ Set' : '❌ Missing');
console.log('client:', !!process.env.client ? '✅ Set' : '❌ Missing');
console.log('clientsecret:', !!process.env.clientsecret ? '✅ Set' : '❌ Missing');

// Test Cashfree initialization
try {
  const { Cashfree, CFEnvironment } = require('cashfree-pg');
  const cashfree = new Cashfree(
    CFEnvironment.PRODUCTION, 
    process.env.CASHFREE_APP_ID, 
    process.env.CASHFREE_SECRET_KEY
  );
  console.log('✅ Cashfree initialized successfully');
} catch (error) {
  console.log('❌ Cashfree initialization failed:', error.message);
}

// Test Database connection
const mongoose = require('mongoose');
mongoose.connect(process.env.mongodb, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(() => {
  console.log('✅ Database connection successful');
  mongoose.disconnect();
}).catch((error) => {
  console.log('❌ Database connection failed:', error.message);
});

console.log('\n📝 Configuration Summary:');
console.log('Environment:', process.env.NODE_ENV);
console.log('Frontend URL:', process.env.frontendurl);
console.log('Backend URL:', process.env.BACKEND_URL);
console.log('Cashfree Mode: PRODUCTION');
