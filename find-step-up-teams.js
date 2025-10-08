/**
 * Script to find and analyze STEP UP team registrations
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

async function findStepUpTeams() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    // Find all STEP UP team compositions
    const stepUpTeams = await TeamComposition.find({ 
      eventName: 'STEP UP' 
    })
    .populate('teamLeader.userId', 'name email contactNo events')
    .populate('teamMembers.userId', 'name email contactNo events')
    .sort({ createdAt: 1 });
    
    if (stepUpTeams.length === 0) {
      console.log('📭 No STEP UP teams found in database');
      return [];
    }
    
    console.log(`🔍 Found ${stepUpTeams.length} STEP UP team registrations:\n`);
    console.log('=' .repeat(80));
    
    stepUpTeams.forEach((team, index) => {
      console.log(`\n🏆 Team ${index + 1}: ${team.teamName}`);
      console.log(`   📅 Team ID: ${team._id}`);
      console.log(`   📧 Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
      console.log(`   👥 Team Size: ${team.totalMembers}`);
      console.log(`   📊 Registration Complete: ${team.registrationComplete ? '✅' : '❌'}`);
      console.log(`   💳 Payment Status: ${team.paymentStatus || 'Not set'}`);
      console.log(`   📅 Created: ${team.createdAt}`);
      
      // Show team leader events
      const leaderUser = team.teamLeader.userId;
      if (leaderUser && leaderUser.events) {
        console.log(`   🎯 Team Leader Events: [${leaderUser.events.join(', ')}]`);
      }
      
      // Show team members
      if (team.teamMembers && team.teamMembers.length > 0) {
        console.log(`   👥 Team Members:`);
        team.teamMembers.forEach((member, memberIndex) => {
          const memberUser = member.userId;
          console.log(`      ${memberIndex + 1}. ${member.name} (${member.email})`);
          if (memberUser && memberUser.events) {
            console.log(`         Events: [${memberUser.events.join(', ')}]`);
          }
        });
      }
      
      console.log('   ' + '-'.repeat(60));
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total STEP UP teams: ${stepUpTeams.length}`);
    console.log(`   Total participants: ${stepUpTeams.reduce((sum, team) => sum + team.totalMembers, 0)}`);
    
    return stepUpTeams;
    
  } catch (error) {
    console.error('❌ Error finding STEP UP teams:', error);
    return [];
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Run the script
if (require.main === module) {
  findStepUpTeams();
}

module.exports = { findStepUpTeams };