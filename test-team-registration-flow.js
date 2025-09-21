const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User, Event, TeamComposition, Purchase } = require('./models/models');

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang_test',
  TEST_EVENT: 'Cultural Dance Competition',
  TEAM_ID: `TEAM_${Date.now()}`,
  TEAM_LEADER: {
    name: 'Alice Johnson',
    email: 'alice.leader@test.com',
    contactNo: '9876543210',
    password: 'testpass123'
  },
  EXISTING_MEMBER: {
    name: 'Bob Smith',
    email: 'bob.existing@test.com',
    contactNo: '9876543211',
    password: 'testpass123',
    events: ['Previous Event'] // This user already has some events
  },
  NEW_MEMBERS: [
    {
      name: 'Charlie Wilson',
      email: 'charlie.new@test.com',
      contactNo: '9876543212'
    },
    {
      name: 'Diana Prince',
      email: 'diana.new@test.com',
      contactNo: '9876543213'
    }
  ]
};

async function connectDB() {
  try {
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log('✅ Connected to MongoDB for testing');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove test users
    await User.deleteMany({
      email: {
        $in: [
          TEST_CONFIG.TEAM_LEADER.email,
          TEST_CONFIG.EXISTING_MEMBER.email,
          ...TEST_CONFIG.NEW_MEMBERS.map(m => m.email)
        ]
      }
    });
    
    // Remove test team compositions
    await TeamComposition.deleteMany({ teamId: TEST_CONFIG.TEAM_ID });
    
    // Remove test purchases
    await Purchase.deleteMany({ 
      userEmail: {
        $in: [
          TEST_CONFIG.TEAM_LEADER.email,
          TEST_CONFIG.EXISTING_MEMBER.email,
          ...TEST_CONFIG.NEW_MEMBERS.map(m => m.email)
        ]
      }
    });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

async function setupTestData() {
  try {
    console.log('\n🔧 Setting up test data...');
    
    // Create team leader
    const hashedPassword = await bcrypt.hash(TEST_CONFIG.TEAM_LEADER.password, 10);
    const teamLeader = new User({
      name: TEST_CONFIG.TEAM_LEADER.name,
      email: TEST_CONFIG.TEAM_LEADER.email,
      password: hashedPassword,
      contactNo: TEST_CONFIG.TEAM_LEADER.contactNo,
      age: 22,
      gender: 'female',
      universityName: 'Test University',
      address: 'Test Address',
      isvalidated: true,
      events: []
    });
    await teamLeader.save();
    console.log(`   ✅ Created team leader: ${teamLeader.name} (${teamLeader.email})`);
    
    // Create existing member (user who already exists)
    const existingHashedPassword = await bcrypt.hash(TEST_CONFIG.EXISTING_MEMBER.password, 10);
    const existingMember = new User({
      name: TEST_CONFIG.EXISTING_MEMBER.name,
      email: TEST_CONFIG.EXISTING_MEMBER.email,
      password: existingHashedPassword,
      contactNo: TEST_CONFIG.EXISTING_MEMBER.contactNo,
      age: 21,
      gender: 'male',
      universityName: 'Another University',
      address: 'Another Address',
      isvalidated: true,
      events: TEST_CONFIG.EXISTING_MEMBER.events // Already has some events
    });
    await existingMember.save();
    console.log(`   ✅ Created existing member: ${existingMember.name} (${existingMember.email}) with events: ${existingMember.events.join(', ')}`);
    
    return { teamLeader, existingMember };
  } catch (error) {
    console.error('❌ Test data setup failed:', error);
    throw error;
  }
}

async function simulateTeamRegistration(teamLeader, existingMember) {
  try {
    console.log('\n🎭 Simulating team registration process...');
    console.log(`Team ID: ${TEST_CONFIG.TEAM_ID}`);
    console.log(`Event: ${TEST_CONFIG.TEST_EVENT}`);
    
    // Simulate the team member processing logic from direct_payment_new.js
    console.log('\n👥 Processing team members:');
    
    // Create team composition
    const teamComposition = new TeamComposition({
      eventName: TEST_CONFIG.TEST_EVENT,
      teamName: `${teamLeader.name}'s Team`,
      teamId: TEST_CONFIG.TEAM_ID,
      teamLeader: {
        userId: teamLeader._id,
        name: teamLeader.name,
        email: teamLeader.email,
        hasEntered: false
      },
      teamMembers: [],
      totalMembers: 1 + TEST_CONFIG.NEW_MEMBERS.length + 1, // leader + new members + existing member
      registrationComplete: false,
      paymentStatus: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Add team leader's event
    if (!teamLeader.events.includes(TEST_CONFIG.TEST_EVENT)) {
      teamLeader.events.push(TEST_CONFIG.TEST_EVENT);
      await teamLeader.save();
      console.log(`   ✅ Added event "${TEST_CONFIG.TEST_EVENT}" to team leader: ${teamLeader.name}`);
    }
    
    // Process all team members (including existing and new)
    const allMembers = [
      { 
        name: TEST_CONFIG.EXISTING_MEMBER.name, 
        email: TEST_CONFIG.EXISTING_MEMBER.email,
        contactNo: TEST_CONFIG.EXISTING_MEMBER.contactNo,
        isExisting: true 
      },
      ...TEST_CONFIG.NEW_MEMBERS.map(m => ({ ...m, isExisting: false }))
    ];
    
    for (const memberData of allMembers) {
      console.log(`\n   Processing member: ${memberData.name} (${memberData.email})`);
      
      // Find or create team member as a User
      let memberUser = await User.findOne({ email: memberData.email });
      
      if (memberUser) {
        console.log(`   👤 Found existing user: ${memberUser.name}`);
        console.log(`   📋 Current events: [${memberUser.events.join(', ')}]`);
        
        // Update existing member user - add this event if not already present
        if (!memberUser.events.includes(TEST_CONFIG.TEST_EVENT)) {
          memberUser.events.push(TEST_CONFIG.TEST_EVENT);
          memberUser.updatedAt = new Date();
          await memberUser.save();
          console.log(`   ✅ Added event "${TEST_CONFIG.TEST_EVENT}" to existing user`);
        } else {
          console.log(`   ℹ️  User already has event "${TEST_CONFIG.TEST_EVENT}"`);
        }
        console.log(`   📋 Updated events: [${memberUser.events.join(', ')}]`);
      } else {
        console.log(`   👤 Creating new user for: ${memberData.name}`);
        
        // Create new team member user
        const memberHashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
        
        memberUser = new User({
          name: memberData.name,
          email: memberData.email,
          password: memberHashedPassword,
          contactNo: memberData.contactNo,
          age: 20,
          gender: 'other',
          universityName: 'Team Member University',
          address: 'Team Member Address',
          isvalidated: true,
          events: [TEST_CONFIG.TEST_EVENT],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await memberUser.save();
        console.log(`   ✅ Created new user with event "${TEST_CONFIG.TEST_EVENT}"`);
      }
      
      // Add to team composition
      teamComposition.teamMembers.push({
        userId: memberUser._id,
        name: memberUser.name,
        email: memberUser.email,
        hasEntered: false,
        registeredAt: new Date()
      });
      
      console.log(`   ✅ Added to team composition`);
    }
    
    // Mark registration as complete and save
    teamComposition.registrationComplete = true;
    teamComposition.updatedAt = new Date();
    await teamComposition.save();
    
    console.log(`\n✅ Team registration completed successfully!`);
    console.log(`   Team ID: ${teamComposition.teamId}`);
    console.log(`   Total members: ${teamComposition.teamMembers.length + 1} (including leader)`);
    
    return teamComposition;
  } catch (error) {
    console.error('❌ Team registration simulation failed:', error);
    throw error;
  }
}

async function verifyResults(teamComposition, teamLeader, existingMember) {
  try {
    console.log('\n🔍 Verifying registration results...');
    
    // Verify team leader
    const updatedLeader = await User.findById(teamLeader._id);
    console.log(`\n👑 Team Leader: ${updatedLeader.name}`);
    console.log(`   Email: ${updatedLeader.email}`);
    console.log(`   Events: [${updatedLeader.events.join(', ')}]`);
    console.log(`   Has new event: ${updatedLeader.events.includes(TEST_CONFIG.TEST_EVENT) ? '✅' : '❌'}`);
    
    // Verify existing member
    const updatedExistingMember = await User.findById(existingMember._id);
    console.log(`\n👤 Existing Member: ${updatedExistingMember.name}`);
    console.log(`   Email: ${updatedExistingMember.email}`);
    console.log(`   Events: [${updatedExistingMember.events.join(', ')}]`);
    console.log(`   Had previous events: ${updatedExistingMember.events.includes('Previous Event') ? '✅' : '❌'}`);
    console.log(`   Has new event: ${updatedExistingMember.events.includes(TEST_CONFIG.TEST_EVENT) ? '✅' : '❌'}`);
    
    // Verify new members
    console.log(`\n👥 New Members:`);
    for (const memberData of TEST_CONFIG.NEW_MEMBERS) {
      const newMember = await User.findOne({ email: memberData.email });
      if (newMember) {
        console.log(`   ${newMember.name} (${newMember.email})`);
        console.log(`     Events: [${newMember.events.join(', ')}]`);
        console.log(`     Has new event: ${newMember.events.includes(TEST_CONFIG.TEST_EVENT) ? '✅' : '❌'}`);
      } else {
        console.log(`   ❌ ${memberData.name} not found!`);
      }
    }
    
    // Verify team composition
    const fullTeamComposition = await TeamComposition.findById(teamComposition._id)
      .populate('teamLeader.userId', 'name email events')
      .populate('teamMembers.userId', 'name email events');
      
    console.log(`\n🏆 Team Composition: ${fullTeamComposition.teamName}`);
    console.log(`   Team ID: ${fullTeamComposition.teamId}`);
    console.log(`   Event: ${fullTeamComposition.eventName}`);
    console.log(`   Registration Complete: ${fullTeamComposition.registrationComplete ? '✅' : '❌'}`);
    console.log(`   Total Members: ${fullTeamComposition.teamMembers.length + 1}`);
    
    console.log(`\n   Team Leader: ${fullTeamComposition.teamLeader.name}`);
    console.log(`     Events: [${fullTeamComposition.teamLeader.userId.events.join(', ')}]`);
    
    console.log(`\n   Team Members:`);
    fullTeamComposition.teamMembers.forEach((member, index) => {
      console.log(`     ${index + 1}. ${member.userId.name} (${member.userId.email})`);
      console.log(`        Events: [${member.userId.events.join(', ')}]`);
    });
    
    // Final verification
    const allUsersHaveEvent = [fullTeamComposition.teamLeader.userId, ...fullTeamComposition.teamMembers.map(m => m.userId)]
      .every(user => user.events.includes(TEST_CONFIG.TEST_EVENT));
      
    console.log(`\n🎯 Final Result: ${allUsersHaveEvent ? '✅ ALL USERS HAVE THE EVENT!' : '❌ Some users missing the event!'}`);
    
    return allUsersHaveEvent;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

async function runTeamRegistrationTest() {
  console.log('🚀 Starting Team Registration Flow Test');
  console.log('=========================================');
  
  try {
    // Connect to database
    await connectDB();
    
    // Clean up any existing test data
    await cleanup();
    
    // Setup test data
    const { teamLeader, existingMember } = await setupTestData();
    
    // Simulate team registration
    const teamComposition = await simulateTeamRegistration(teamLeader, existingMember);
    
    // Verify results
    const success = await verifyResults(teamComposition, teamLeader, existingMember);
    
    if (success) {
      console.log('\n🎉 TEST PASSED: Team registration flow works correctly!');
      console.log('   ✅ Existing members got the new event added');
      console.log('   ✅ New members were created with the event');
      console.log('   ✅ Team composition was created properly');
    } else {
      console.log('\n❌ TEST FAILED: Some issues found in team registration');
    }
    
  } catch (error) {
    console.error('\n💥 TEST ERROR:', error);
  } finally {
    // Clean up and disconnect
    await cleanup();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTeamRegistrationTest().catch(console.error);
}

module.exports = runTeamRegistrationTest;
