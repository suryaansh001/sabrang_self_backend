const mongoose = require('mongoose');
const { User } = require('./models/models');
require('dotenv').config();

async function findUser() {
  try {
    console.log('🔍 Searching for Varun Rampe...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');
    
    // Search by email
    const email = 'varunrampe@gmail.com';
    console.log(`Searching by email: ${email}`);
    
    const userByEmail = await User.findOne({ email: email });
    
    if (userByEmail) {
      console.log('✅ User found by email!');
      console.log(`   - ID: ${userByEmail._id}`);
      console.log(`   - Name: ${userByEmail.name}`);
      console.log(`   - Email: ${userByEmail.email}`);
      console.log(`   - Contact: ${userByEmail.contactNo}`);
      console.log(`   - Events: ${userByEmail.events.join(', ')}`);
      console.log(`   - Has QR Code: ${userByEmail.qrCodeBase64 ? 'Yes' : 'No'}`);
      console.log(`   - QR Code Preview: ${userByEmail.qrCodeBase64 ? userByEmail.qrCodeBase64.substring(0, 50) + '...' : 'None'}`);
      
      // Now test searching by ObjectId
      console.log(`\n🔍 Testing search by ObjectId: ${userByEmail._id}`);
      const userById = await User.findById(userByEmail._id);
      
      if (userById) {
        console.log('✅ User found by ObjectId!');
        console.log(`   - Name: ${userById.name}`);
        console.log(`   - Email: ${userById.email}`);
      } else {
        console.log('❌ User NOT found by ObjectId');
      }
      
      // Test QR scanning endpoint data format
      console.log('\n📱 QR Scanning Data:');
      console.log(`   - QR Data (for scanning): ${userByEmail._id.toString()}`);
      console.log(`   - QR Base64 Available: ${userByEmail.qrCodeBase64 ? 'Yes' : 'No'}`);
      
    } else {
      console.log('❌ User NOT found by email');
      
      // Let's check if there are any users with similar email
      console.log('\n🔍 Searching for similar emails...');
      const similarUsers = await User.find({ 
        email: { $regex: 'varun', $options: 'i' } 
      });
      
      if (similarUsers.length > 0) {
        console.log(`Found ${similarUsers.length} users with "varun" in email:`);
        similarUsers.forEach(user => {
          console.log(`   - ${user.name} (${user.email})`);
        });
      } else {
        console.log('No users found with "varun" in email');
      }
    }
    
    // Let's also check all FREE FIRE TOURNAMENT users
    console.log('\n🎮 All FREE FIRE TOURNAMENT users:');
    const freefireUsers = await User.find({ events: 'FREE FIRE TOURNAMENT' });
    
    if (freefireUsers.length > 0) {
      console.log(`Found ${freefireUsers.length} FREE FIRE TOURNAMENT users:`);
      freefireUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${user._id}`);
      });
    } else {
      console.log('No FREE FIRE TOURNAMENT users found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the search
findUser()
  .then(() => {
    console.log('\n🏁 Search completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Search failed:', error.message);
    process.exit(1);
  });