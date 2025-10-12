const mongoose = require('mongoose');
const { User } = require('./models/models');
const qrcode = require('qrcode');
require('dotenv').config();

// Team members data
const teamMembers = [
  {
    name: 'Sangeeth',
    email: 'sangeeth.addepalli@gmail.com',
    contactNo: '8977868159',
    isLeader: true
  },
  {
    name: 'Ashwit',
    email: 'uduthalaashwit@gmail.com',
    contactNo: '9347487107',
    isLeader: false
  },
  {
    name: 'Shiva',
    email: 'chepyalashivakrishna@gmail.com',
    contactNo: '6303766064',
    isLeader: false
  },
  {
    name: 'Varun Rampe',
    email: 'varunrampe@gmail.com',
    contactNo: '6300045447',
    isLeader: false
  }
];

// Function to generate QR code as base64
async function generateQRCodeBase64(userId) {
  try {
    const qrCodeBase64 = await qrcode.toDataURL(userId.toString(), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeBase64;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

// Function to add user to schema
async function addUserToSchema(memberData) {
  try {
    console.log(`\n📝 Processing: ${memberData.name} (${memberData.email})`);
    
    // Check if user already exists
    let user = await User.findOne({ email: memberData.email });
    
    if (user) {
      console.log(`👤 User already exists: ${user.name}`);
      
      // Update existing user
      if (!user.events.includes('FREE FIRE TOURNAMENT')) {
        user.events.push('FREE FIRE TOURNAMENT');
        console.log('   ✅ Added FREE FIRE TOURNAMENT to events');
      }
      
      if (!user.contactNo) {
        user.contactNo = memberData.contactNo;
        console.log('   ✅ Added contact number');
      }
      
      user.isvalidated = true;
      user.updatedAt = new Date();
      
      // Generate QR if missing
      if (!user.qrCodeBase64) {
        console.log('   🔲 Generating QR code...');
        const qrCode = await generateQRCodeBase64(user._id);
        if (qrCode) {
          user.qrCodeBase64 = qrCode;
          user.qrPath = `qr_${user._id}.png`;
          console.log('   ✅ QR code generated');
        }
      } else {
        console.log('   🔲 QR code already exists');
      }
      
      await user.save();
      console.log(`   ✅ User updated: ${user._id}`);
      return user;
      
    } else {
      console.log(`✨ Creating new user: ${memberData.name}`);
      
      // Create new user
      user = new User({
        name: memberData.name,
        email: memberData.email,
        contactNo: memberData.contactNo,
        events: ['FREE FIRE TOURNAMENT'],
        isvalidated: true,
        hasEntered: false,
        userType: 'participant',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Save user first to get ID
      await user.save();
      console.log(`   ✅ User created with ID: ${user._id}`);
      
      // Generate QR code
      console.log('   🔲 Generating QR code...');
      const qrCode = await generateQRCodeBase64(user._id);
      if (qrCode) {
        user.qrCodeBase64 = qrCode;
        user.qrPath = `qr_${user._id}.png`;
        await user.save();
        console.log('   ✅ QR code generated and saved');
      }
      
      return user;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${memberData.name}:`, error.message);
    throw error;
  }
}

// Main function
async function addTeamMembersToUserSchema() {
  try {
    console.log('🚀 Adding FREE FIRE TOURNAMENT team members to User schema...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    const addedUsers = [];
    
    // Process each team member
    for (const member of teamMembers) {
      const user = await addUserToSchema(member);
      addedUsers.push(user);
    }
    
    // Verification
    console.log('\n🔍 VERIFICATION - All team members in User schema:');
    console.log('=' .repeat(60));
    
    for (let i = 0; i < addedUsers.length; i++) {
      const user = addedUsers[i];
      const member = teamMembers[i];
      
      console.log(`${i + 1}. ${user.name} ${member.isLeader ? '(LEADER)' : '(MEMBER)'}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   📱 Contact: ${user.contactNo}`);
      console.log(`   🆔 User ID: ${user._id}`);
      console.log(`   🎮 Events: ${user.events.join(', ')}`);
      console.log(`   ✅ Validated: ${user.isvalidated}`);
      console.log(`   🔲 Has QR: ${user.qrCodeBase64 ? 'Yes' : 'No'}`);
      console.log(`   📅 Created: ${user.createdAt.toISOString().split('T')[0]}`);
      console.log('');
    }
    
    // Final summary
    console.log('🎉 SUCCESS: All team members added to User schema!');
    console.log(`   Total Users: ${addedUsers.length}`);
    console.log(`   Leaders: ${addedUsers.filter((u, i) => teamMembers[i].isLeader).length}`);
    console.log(`   Members: ${addedUsers.filter((u, i) => !teamMembers[i].isLeader).length}`);
    console.log(`   With QR Codes: ${addedUsers.filter(u => u.qrCodeBase64).length}`);
    console.log(`   Validated: ${addedUsers.filter(u => u.isvalidated).length}`);
    
    // Test QR scanning for one user
    console.log('\n🔍 QR SCANNING TEST:');
    const testUser = addedUsers[3]; // Varun Rampe
    console.log(`Testing QR scan for: ${testUser.name}`);
    console.log(`QR Data: ${testUser._id.toString()}`);
    console.log(`QR Base64 Preview: ${testUser.qrCodeBase64 ? testUser.qrCodeBase64.substring(0, 50) + '...' : 'None'}`);
    
    return addedUsers;
    
  } catch (error) {
    console.error('\n❌ Error in adding team members:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addTeamMembersToUserSchema()
    .then(() => {
      console.log('\n🏁 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addTeamMembersToUserSchema };