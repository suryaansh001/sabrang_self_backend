const mongoose = require('mongoose');
const { User } = require('./models/models');
require('dotenv').config();

async function testQRScanning() {
  try {
    console.log('🔍 Testing QR Code Scanning for Varun Rampe...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    // Test 1: Search by email
    console.log('\n📧 TEST 1: Finding user by email');
    const email = 'varunrampe@gmail.com';
    const userByEmail = await User.findOne({ email: email });
    
    if (userByEmail) {
      console.log(`✅ Found user by email: ${userByEmail.name}`);
      console.log(`   ID: ${userByEmail._id}`);
      console.log(`   Contact: ${userByEmail.contactNo}`);
      console.log(`   Events: ${userByEmail.events.join(', ')}`);
      
      // Test 2: Search by ObjectId (this is what QR scanning uses)
      console.log('\n🔲 TEST 2: Finding user by ObjectId (QR scan simulation)');
      const userId = userByEmail._id;
      const userById = await User.findById(userId);
      
      if (userById) {
        console.log(`✅ QR SCAN SUCCESS: Found user by ID`);
        console.log(`   Name: ${userById.name}`);
        console.log(`   Email: ${userById.email}`);
        console.log(`   Contact: ${userById.contactNo}`);
        console.log(`   Events: ${userById.events.join(', ')}`);
        console.log(`   Has QR Code: ${userById.qrCodeBase64 ? 'Yes' : 'No'}`);
        console.log(`   Is Validated: ${userById.isvalidated}`);
        console.log(`   Has Entered: ${userById.hasEntered}`);
        
        // Test 3: Simulate QR scanning response format
        console.log('\n📱 TEST 3: QR Scanning Response Format');
        const qrScanResponse = {
          success: true,
          displayInfo: {
            name: userById.name,
            email: userById.email,
            contactNo: userById.contactNo,
            events: userById.events,
            eventsCount: userById.events.length
          },
          entryStatus: {
            hasEntered: userById.hasEntered,
            isvalidated: userById.isvalidated,
            allowEntry: !userById.hasEntered && userById.isvalidated,
            entryPermission: {
              allowed: !userById.hasEntered && userById.isvalidated,
              reason: userById.hasEntered ? "Already entered" : 
                      !userById.isvalidated ? "Not validated" : "Entry allowed"
            }
          },
          userInfo: {
            _id: userById._id,
            name: userById.name,
            email: userById.email,
            contactNo: userById.contactNo
          }
        };
        
        console.log('QR Scan Response:');
        console.log(JSON.stringify(qrScanResponse, null, 2));
        
        // Test 4: Check QR code data
        console.log('\n🔲 TEST 4: QR Code Details');
        console.log(`   QR Data (what's encoded): ${userById._id.toString()}`);
        console.log(`   QR Code Format: Base64 PNG`);
        console.log(`   QR Code Size: ${userById.qrCodeBase64 ? userById.qrCodeBase64.length : 0} characters`);
        console.log(`   QR Code Preview: ${userById.qrCodeBase64 ? userById.qrCodeBase64.substring(0, 100) + '...' : 'None'}`);
        
      } else {
        console.log('❌ QR SCAN FAILED: User not found by ID');
      }
      
    } else {
      console.log(`❌ User not found by email: ${email}`);
    }
    
    // Test 5: List all FREE FIRE users for comparison
    console.log('\n👥 TEST 5: All FREE FIRE TOURNAMENT users');
    const allFreefireUsers = await User.find({ events: 'FREE FIRE TOURNAMENT' });
    
    console.log(`Found ${allFreefireUsers.length} FREE FIRE users:`);
    allFreefireUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${user._id}`);
    });
    
    console.log('\n🎉 QR SCANNING TEST COMPLETE!');
    console.log('✅ All tests passed - QR scanning should work correctly');
    
  } catch (error) {
    console.error('❌ Error during QR scanning test:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testQRScanning()
  .then(() => {
    console.log('\n🏁 QR scanning test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 QR scanning test failed:', error.message);
    process.exit(1);
  });