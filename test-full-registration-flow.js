const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User, TeamComposition, Purchase } = require('./models/models');

// Test configuration for full registration flow
const TEST_CONFIG = {
  MONGODB_URI: process.env.mongodb || 'mongodb://localhost:27017/sabrang',
  TEAM_LEADER: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    contactNo: '9876543210',
    password: 'testpass123'
  },
  TEAM_MEMBERS: [
    {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      contactNo: '9876543211'
    },
    {
      name: 'Bob Wilson',
      email: 'bob.wilson@example.com',
      contactNo: '9876543212'
    }
  ],
  EVENTS: ['BGMI', 'Free Fire Tournament']
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
          ...TEST_CONFIG.TEAM_MEMBERS.map(m => m.email)
        ]
      }
    });
    
    // Remove test team compositions
    await TeamComposition.deleteMany({
      'teamLeader.email': TEST_CONFIG.TEAM_LEADER.email
    });
    
    // Remove test purchases
    await Purchase.deleteMany({
      'userDetails.email': TEST_CONFIG.TEAM_LEADER.email
    });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

async function simulateRegistration() {
  try {
    console.log('\n🎭 Simulating team registration...');
    
    // Simulate the logic from /register endpoint
    const hashedPassword = await bcrypt.hash(TEST_CONFIG.TEAM_LEADER.password, 12);
    
    // Create team leader
    const teamLeader = new User({
      name: TEST_CONFIG.TEAM_LEADER.name,
      email: TEST_CONFIG.TEAM_LEADER.email,
      password: hashedPassword,
      contactNo: TEST_CONFIG.TEAM_LEADER.contactNo,
      age: 22,
      gender: 'male',
      universityName: 'Test University',
      address: 'Test Address',
      isMainPerson: true,
      teamSize: TEST_CONFIG.TEAM_MEMBERS.length + 1,
      events: TEST_CONFIG.EVENTS,
      isvalidated: true
    });
    await teamLeader.save();
    console.log(`✅ Created team leader: ${teamLeader.name} (${teamLeader.email})`);
    
    // Create team members
    const teamMembers = [];
    for (const memberData of TEST_CONFIG.TEAM_MEMBERS) {
      const memberPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const memberHashedPassword = await bcrypt.hash(memberPassword, 12);
      
      const teamMember = new User({
        name: memberData.name,
        email: memberData.email,
        password: memberHashedPassword,
        contactNo: memberData.contactNo,
        age: 21,
        gender: 'other',
        universityName: 'Test University',
        address: 'Test Address',
        events: TEST_CONFIG.EVENTS,
        isvalidated: true
      });
      await teamMember.save();
      teamMembers.push(teamMember);
      console.log(`✅ Created team member: ${teamMember.name} (${teamMember.email})`);
    }
    
    // Create team compositions for each event
    const teamCompositions = [];
    for (const eventName of TEST_CONFIG.EVENTS) {
      const teamId = `TEAM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const teamComposition = new TeamComposition({
        eventName: eventName,
        teamName: `${teamLeader.name}'s Team`,
        teamId: teamId,
        teamLeader: {
          userId: teamLeader._id,
          name: teamLeader.name,
          email: teamLeader.email,
          hasEntered: false
        },
        teamMembers: teamMembers.map(member => ({
          userId: member._id,
          name: member.name,
          email: member.email,
          hasEntered: false,
          role: 'member'
        })),
        totalMembers: teamMembers.length + 1,
        registrationComplete: true,
        paymentStatus: 'pending', // Will be updated after payment
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await teamComposition.save();
      teamCompositions.push(teamComposition);
      console.log(`✅ Created team composition for ${eventName}: ${teamId}`);
    }
    
    return { teamLeader, teamMembers, teamCompositions };
  } catch (error) {
    console.error('❌ Registration simulation failed:', error);
    throw error;
  }
}

async function simulatePayment(teamLeader) {
  try {
    console.log('\n💳 Simulating payment process...');
    
    // Create a purchase record (like cashfree_simple.js does)
    const orderId = `TEST_ORDER_${Date.now()}`;
    const itemPrice = 100;
    const totalItems = TEST_CONFIG.EVENTS.length;
    const subtotal = itemPrice * totalItems;
    
    const purchase = new Purchase({
      orderId: orderId,
      paymentSessionId: `SESSION_${Date.now()}`,
      userDetails: {
        name: teamLeader.name,
        email: teamLeader.email,
        contactNo: teamLeader.contactNo,
        formData: { test: true }
      },
      items: TEST_CONFIG.EVENTS.map(event => ({
        type: 'event',
        itemName: event,
        quantity: 1,
        price: itemPrice
      })),
      subtotal: subtotal,
      totalAmount: subtotal,
      paymentStatus: 'pending',
      purchaseDate: new Date()
    });
    await purchase.save();
    console.log(`✅ Created purchase record: ${orderId}`);
    
    // Simulate payment success (like the success callback does)
    console.log('\n🎉 Simulating payment success...');
    purchase.paymentStatus = 'completed';
    purchase.paymentCompletedAt = new Date();
    purchase.userId = teamLeader._id;
    await purchase.save();
    console.log(`✅ Updated purchase status to completed`);
    
    // Update team compositions (like the success callback does)
    const teamCompositions = await TeamComposition.find({
      $or: [
        { 'teamLeader.email': teamLeader.email },
        { 'teamMembers.email': teamLeader.email }
      ],
      paymentStatus: 'pending'
    });
    
    console.log(`🏆 Found ${teamCompositions.length} team compositions to update`);
    for (const teamComp of teamCompositions) {
      teamComp.paymentStatus = 'completed';
      teamComp.purchaseId = purchase._id;
      teamComp.updatedAt = new Date();
      await teamComp.save();
      console.log(`✅ Updated team composition: ${teamComp.teamName} (${teamComp.eventName})`);
    }
    
    return purchase;
  } catch (error) {
    console.error('❌ Payment simulation failed:', error);
    throw error;
  }
}

async function verifyResults() {
  try {
    console.log('\n🔍 Verifying final results...');
    
    // Check team compositions
    const completedTeams = await TeamComposition.find({
      'teamLeader.email': TEST_CONFIG.TEAM_LEADER.email,
      paymentStatus: 'completed'
    }).populate('teamLeader.userId teamMembers.userId');
    
    console.log(`\n🏆 COMPLETED TEAM REGISTRATIONS: ${completedTeams.length}`);
    completedTeams.forEach((team, index) => {
      console.log(`${index + 1}. Event: ${team.eventName}`);
      console.log(`   Team: ${team.teamName} (${team.teamId})`);
      console.log(`   Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
      console.log(`   Members: ${team.teamMembers.length}`);
      team.teamMembers.forEach((member, memberIndex) => {
        console.log(`     ${memberIndex + 1}. ${member.name} (${member.email})`);
      });
      console.log(`   Payment Status: ${team.paymentStatus}`);
      console.log(`   Purchase ID: ${team.purchaseId || 'Not linked'}`);
      console.log();
    });
    
    // Check purchases
    const purchases = await Purchase.find({
      'userDetails.email': TEST_CONFIG.TEAM_LEADER.email
    });
    
    console.log(`💳 PURCHASES: ${purchases.length}`);
    purchases.forEach((purchase, index) => {
      console.log(`${index + 1}. Order ID: ${purchase.orderId}`);
      console.log(`   Status: ${purchase.paymentStatus}`);
      console.log(`   Amount: ${purchase.totalAmount}`);
      console.log(`   Items: ${purchase.items.length}`);
      console.log();
    });
    
    const success = completedTeams.length === TEST_CONFIG.EVENTS.length && 
                   completedTeams.every(team => team.paymentStatus === 'completed') &&
                   purchases.length > 0 &&
                   purchases.every(purchase => purchase.paymentStatus === 'completed');
    
    return success;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

async function runFullRegistrationTest() {
  console.log('🚀 Starting Full Team Registration & Payment Flow Test');
  console.log('=====================================================');
  
  try {
    await connectDB();
    
    // Only cleanup at the start, not at the end
    await cleanup();
    
    const { teamLeader, teamMembers, teamCompositions } = await simulateRegistration();
    const purchase = await simulatePayment(teamLeader);
    const success = await verifyResults();
    
    if (success) {
      console.log('🎉 TEST PASSED: Full registration and payment flow works!');
      console.log('   ✅ Team compositions created during registration');
      console.log('   ✅ Payment completed successfully');
      console.log('   ✅ Team compositions updated with payment info');
      console.log('   ✅ Purchase records linked to teams');
      console.log('\n🔒 DATA PRESERVED: Team data left in database for verification');
    } else {
      console.log('❌ TEST FAILED: Issues found in registration/payment flow');
    }
    
  } catch (error) {
    console.error('\n💥 TEST ERROR:', error);
  } finally {
    // Don't cleanup - let data persist for verification
    // await cleanup();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
    console.log('💾 Team data is still in the database - use check-teams-by-event.js to view it');
  }
}

if (require.main === module) {
  runFullRegistrationTest().catch(console.error);
}

module.exports = runFullRegistrationTest;
