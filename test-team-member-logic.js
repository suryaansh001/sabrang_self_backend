#!/usr/bin/env node

/**
 * Test Team Member Processing Logic
 * Tests the enhanced team member handling for existing vs new users
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { User, Purchase, TeamComposition } = require('./models/models');

async function testTeamMemberLogic() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔌 Connected to MongoDB');

    // Test data
    const testEvent = 'TEST_TEAM_EVENT';
    const teamLeaderEmail = 'testleader@example.com';
    
    // Team members - mix of existing and new users
    const teamMembers = [
      {
        name: 'Existing User One',
        email: 'existing1@example.com',
        contactNo: '1111111111',
        gender: 'Male',
        age: 20,
        universityName: 'Test University',
        address: 'Test Address'
      },
      {
        name: 'New User One',
        email: 'newuser1@example.com',
        contactNo: '2222222222',
        gender: 'Female',
        age: 21,
        universityName: 'New University',
        address: 'New Address'
      }
    ];

    // Create a test existing user
    console.log('\n📝 Setting up test data...');
    let existingUser = await User.findOne({ email: 'existing1@example.com' });
    if (!existingUser) {
      existingUser = new User({
        name: 'Existing User One',
        email: 'existing1@example.com',
        password: 'hashedpassword',
        contactNo: '1111111111',
        events: ['PREVIOUS_EVENT'], // Already has an event
        isvalidated: true
      });
      await existingUser.save();
      console.log('✅ Created existing user for testing');
    } else {
      console.log('ℹ️ Using existing test user');
    }

    // Test team member processing logic
    console.log('\n🧪 Testing team member processing logic...');
    
    for (const memberData of teamMembers) {
      try {
        console.log(`\n👤 Processing: ${memberData.name} (${memberData.email})`);
        
        // Find or create team member as a User
        let memberUser = await User.findOne({ email: memberData.email.toLowerCase().trim() });
        
        if (memberUser) {
          // EXISTING USER: Update their event details
          console.log(`   🔄 EXISTING USER found`);
          console.log(`   📋 Current events: ${memberUser.events.join(', ')}`);
          
          // Add this event to their events array if not already present
          if (!memberUser.events.includes(testEvent)) {
            memberUser.events.push(testEvent);
            console.log(`   ✅ Added event "${testEvent}" to existing user`);
          } else {
            console.log(`   ℹ️ User already registered for event "${testEvent}"`);
          }
          
          // Update user details with latest information
          memberUser.name = memberData.name || memberUser.name;
          memberUser.contactNo = memberData.contactNo || memberUser.contactNo;
          memberUser.gender = memberData.gender || memberUser.gender;
          memberUser.age = memberData.age || memberUser.age;
          memberUser.universityName = memberData.universityName || memberUser.universityName;
          memberUser.address = memberData.address || memberUser.address;
          memberUser.isvalidated = true;
          memberUser.updatedAt = new Date();
          
        } else {
          // NEW USER: Create as new team member
          console.log(`   🆕 NEW USER - creating account`);
          
          const bcrypt = require('bcrypt');
          const memberHashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
          
          memberUser = new User({
            name: memberData.name,
            email: memberData.email.toLowerCase().trim(),
            password: memberHashedPassword,
            contactNo: memberData.contactNo || '',
            gender: memberData.gender || '',
            age: memberData.age || null,
            universityName: memberData.universityName || '',
            address: memberData.address || '',
            events: [testEvent], // Start with this team event
            isvalidated: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log(`   ✅ Created new user for event "${testEvent}"`);
        }
        
        // Save the user
        await memberUser.save();
        console.log(`   💾 User saved successfully`);
        console.log(`   📋 Final events: ${memberUser.events.join(', ')}`);
        
      } catch (error) {
        console.error(`   ❌ Error processing ${memberData.email}:`, error.message);
      }
    }

    console.log('\n✅ Team member logic test completed!');
    
    // Show final state
    console.log('\n📊 Final User States:');
    for (const memberData of teamMembers) {
      const user = await User.findOne({ email: memberData.email });
      if (user) {
        console.log(`   ${user.name}: ${user.events.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testTeamMemberLogic();
}

module.exports = testTeamMemberLogic;
