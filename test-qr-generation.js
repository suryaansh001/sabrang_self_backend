/**
 * Test QR code generation for specific user
 * Testing proper QR code image generation using qrCodeService
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');

async function testQRGeneration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🧪 TESTING QR CODE GENERATION');
    console.log('=' .repeat(60));
    
    // Find the specific user
    const testEmail = 'vikaschoudhary@jklu.edu.in';
    console.log(`\n🔍 Finding user: ${testEmail}`);
    
    const user = await User.findOne({ email: testEmail });
    
    if (!user) {
      console.error(`❌ User not found: ${testEmail}`);
      return;
    }
    
    console.log(`✅ Found user: ${user.name} (ID: ${user._id})`);
    console.log(`📱 Current QR code: ${user.qrCodeBase64 ? 'Exists' : 'Missing'}`);
    
    if (user.qrCodeBase64) {
      console.log(`📏 Current QR length: ${user.qrCodeBase64.length} characters`);
      
      // Check if it's just base64 encoded text or actual image
      try {
        const decoded = Buffer.from(user.qrCodeBase64, 'base64').toString('utf8');
        if (decoded === user._id.toString()) {
          console.log('⚠️  Current QR is just base64 encoded ObjectID, not an actual QR image');
        } else {
          console.log('✅ Current QR appears to be a proper QR code image');
        }
      } catch (e) {
        console.log('✅ Current QR appears to be a proper QR code image (binary data)');
      }
    }
    
    console.log('\n🔄 Generating new QR code using qrCodeService...');
    
    // Generate proper QR code using the service
    const newQRCode = await generateUserQRCode(user._id.toString(), user);
    
    console.log(`✅ New QR code generated successfully!`);
    console.log(`📏 New QR length: ${newQRCode.length} characters`);
    
    // Update the user with the new QR code
    console.log('\n💾 Updating user with new QR code...');
    await User.findByIdAndUpdate(user._id, { qrCodeBase64: newQRCode });
    
    console.log('✅ User updated successfully!');
    
    // Verify the update
    const updatedUser = await User.findById(user._id).select('name email qrCodeBase64');
    console.log(`\n🔍 Verification:`);
    console.log(`   User: ${updatedUser.name}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   QR Code: ${updatedUser.qrCodeBase64 ? 'Present' : 'Missing'}`);
    console.log(`   QR Length: ${updatedUser.qrCodeBase64 ? updatedUser.qrCodeBase64.length : 0} characters`);
    
    // Test if it's a proper image by checking PNG header
    if (updatedUser.qrCodeBase64) {
      const buffer = Buffer.from(updatedUser.qrCodeBase64, 'base64');
      const isPNG = buffer.length > 8 && 
                   buffer[0] === 0x89 && 
                   buffer[1] === 0x50 && 
                   buffer[2] === 0x4E && 
                   buffer[3] === 0x47;
      
      console.log(`   Is PNG Image: ${isPNG ? '✅ Yes' : '❌ No'}`);
      
      if (isPNG) {
        console.log('\n🎉 SUCCESS: QR code is properly generated as a PNG image!');
        console.log('📱 This QR code can now be displayed and scanned properly.');
      } else {
        console.log('\n⚠️  WARNING: QR code may not be a proper PNG image.');
      }
    }
    
    console.log('\n🧪 TEST COMPLETED');
    
  } catch (error) {
    console.error('❌ Error in QR generation test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Run the test
testQRGeneration();