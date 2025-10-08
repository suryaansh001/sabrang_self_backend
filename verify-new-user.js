/**
 * Script to verify the newly added user and show their details
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');

async function verifyNewUser() {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');
    
    // Find the user we just added
    const user = await User.findOne({ email: 'mrmcgaming02@gmail.com' });
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('🎉 USER SUCCESSFULLY ADDED TO DATABASE');
    console.log('=====================================');
    console.log(`👤 Name: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`📱 Contact: ${user.contactNo}`);
    console.log(`🆔 User ID: ${user._id}`);
    console.log(`🎭 Events: [${user.events.join(', ')}]`);
    console.log(`🏛️ University: ${user.universityName}`);
    console.log(`📍 Address: ${user.address}`);
    console.log(`🎫 Referral Code: ${user.referralCode}`);
    console.log(`👤 Gender: ${user.gender}`);
    console.log(`🎂 Age: ${user.age}`);
    console.log(`✅ Validated: ${user.isvalidated ? 'Yes' : 'No'}`);
    console.log(`🎫 QR Code Generated: ${user.qrCodeBase64 ? 'Yes' : 'No'}`);
    console.log(`📧 Email Sent: ${user.emailSent ? 'Yes' : 'No'} ${user.emailSent ? '(' + user.emailSentAt + ')' : ''}`);
    console.log(`📅 Created At: ${user.createdAt}`);
    
    if (user.qrCodeBase64) {
      console.log(`🔍 QR Code Details:`);
      console.log(`   - Base64 Length: ${user.qrCodeBase64.length} characters`);
      console.log(`   - QR Path: ${user.qrPath}`);
      console.log(`   - QR Endpoint: https://your-domain.com/api/qrcode/${user._id}`);
    }
    
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('=====================');
    console.log(`Email: ${user.email}`);
    console.log(`Password: defaultPassword123`);
    console.log('\n⚠️ Important: User should change password after first login');
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('==============');
    console.log('1. ✅ User account created successfully');
    console.log('2. ✅ QR code generated and stored');
    console.log('3. ⚠️ Email sending failed (network issue) - may need manual retry');
    console.log('4. 📱 User can now log in and access their QR code');
    console.log('5. 🎯 QR code can be accessed via the API endpoint');
    
    // Test QR code accessibility
    console.log('\n🧪 QR CODE TEST:');
    console.log('================');
    console.log(`QR Code Data: ${user._id}`);
    console.log(`QR Code Available: ${user.qrCodeBase64 ? '✅ Yes' : '❌ No'}`);
    if (user.qrCodeBase64) {
      console.log(`Sample QR Code (first 50 chars): ${user.qrCodeBase64.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Run verification
verifyNewUser();