/**
 * Script to check database status and find users with STEP UP events
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

async function checkStepUpStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    // Check total team compositions
    const totalTeams = await TeamComposition.countDocuments();
    console.log(`📊 Total team compositions in database: ${totalTeams}`);
    
    // List all unique event names in team compositions
    const eventNames = await TeamComposition.distinct('eventName');
    console.log(`🎯 Events with team compositions: [${eventNames.join(', ')}]`);
    
    // Check for users with STEP UP in their events
    console.log('\n🔍 Checking users with STEP UP events...');
    const stepUpUsers = await User.find({ 
      events: 'STEP UP' 
    }).select('name email events contactNo').limit(20);
    
    if (stepUpUsers.length > 0) {
      console.log(`\n👥 Found ${stepUpUsers.length} users with STEP UP in their events:`);
      stepUpUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Contact: ${user.contactNo || 'Not provided'}`);
        console.log('');
      });
    } else {
      console.log('📭 No users found with STEP UP in their events');
    }
    
    // Check for users with both STEP UP and DANCE BATTLE
    const dualUsers = await User.find({ 
      events: { $all: ['STEP UP', 'DANCE BATTLE'] }
    }).select('name email events contactNo');
    
    if (dualUsers.length > 0) {
      console.log(`\n💃 Found ${dualUsers.length} users with both STEP UP and DANCE BATTLE:`);
      dualUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Contact: ${user.contactNo || 'Not provided'}`);
        console.log('');
      });
    } else {
      console.log('📭 No users found with both STEP UP and DANCE BATTLE');
    }
    
    // Count total users with STEP UP
    const stepUpCount = await User.countDocuments({ events: 'STEP UP' });
    console.log(`\n📊 Total users with STEP UP: ${stepUpCount}`);
    
  } catch (error) {
    console.error('❌ Error checking STEP UP status:', error);
  } finally {
    process.exit(0);
  }
}

// Load environment variables
require('dotenv').config();

// Run the script
checkStepUpStatus();