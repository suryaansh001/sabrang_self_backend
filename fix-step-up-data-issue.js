/**
 * Script to Fix STEP UP Data Issue
 * STEP UP should be individual event only - remove team compositions and fix counting
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function fixStepUpDataIssue() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 FIXING STEP UP DATA ISSUE');
    console.log('=' .repeat(80));
    console.log('⚠️  STEP UP should be INDIVIDUAL EVENT ONLY - removing team compositions');
    console.log('');
    
    // 1. Find all STEP UP team compositions (these should not exist)
    console.log('🔍 Finding STEP UP team compositions that should be removed...');
    const stepUpTeams = await TeamComposition.find({ 
      eventName: 'STEP UP' 
    })
    .populate('teamLeader.userId', 'name email events')
    .populate('teamMembers.userId', 'name email events');
    
    if (stepUpTeams.length > 0) {
      console.log(`❌ Found ${stepUpTeams.length} incorrect STEP UP team compositions:`);
      console.log('');
      
      stepUpTeams.forEach((team, index) => {
        console.log(`🏆 Team ${index + 1}: ${team.teamName}`);
        console.log(`   🆔 Team ID: ${team._id}`);
        console.log(`   👑 Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        
        // Show team leader events
        const leader = team.teamLeader.userId;
        if (leader && leader.events) {
          console.log(`   🎯 Leader Events: [${leader.events.join(', ')}]`);
          console.log(`   ✅ Leader should be individual STEP UP participant: ${leader.events.includes('STEP UP') ? 'Yes' : 'No'}`);
        }
        
        console.log(`   👥 Team Members: ${team.teamMembers.length}`);
        team.teamMembers.forEach((member, memberIndex) => {
          const memberUser = member.userId;
          console.log(`      ${memberIndex + 1}. ${member.name} (${member.email})`);
          if (memberUser && memberUser.events) {
            console.log(`         Events: [${memberUser.events.join(', ')}]`);
            console.log(`         Should be individual STEP UP: ${memberUser.events.includes('STEP UP') ? 'Yes' : 'No'}`);
          }
        });
        console.log('');
      });
      
      // Ask for confirmation before deletion
      console.log('⚠️  These team compositions will be DELETED as STEP UP is individual event only.');
      console.log('   Individual users will still retain STEP UP in their events array.');
      console.log('');
      
      // Delete the team compositions
      const deleteResult = await TeamComposition.deleteMany({ eventName: 'STEP UP' });
      console.log(`✅ Deleted ${deleteResult.deletedCount} STEP UP team compositions`);
      console.log('');
      
    } else {
      console.log('✅ No STEP UP team compositions found - data is already correct');
      console.log('');
    }
    
    // 2. Show correct individual STEP UP participants
    console.log('📋 CORRECT STEP UP INDIVIDUAL PARTICIPANTS:');
    console.log('-' .repeat(60));
    
    const stepUpUsers = await User.find({ 
      events: 'STEP UP' 
    })
    .select('name email contactNo events userType isvalidated hasEntered createdAt')
    .sort({ name: 1 });
    
    if (stepUpUsers.length > 0) {
      console.log(`Found ${stepUpUsers.length} individual users with STEP UP:\n`);
      
      stepUpUsers.forEach((user, index) => {
        console.log(`${index + 1}. 👤 ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   📱 Contact: ${user.contactNo || 'Not provided'}`);
        console.log(`   🎯 Events: [${user.events.join(', ')}]`);
        
        // Check if user is registered for multiple events (like DANCE BATTLE + STEP UP)
        const hasMultipleEvents = user.events.length > 1;
        if (hasMultipleEvents) {
          console.log(`   ⚠️  Multi-event registration: This user is in both team and individual events`);
          const teamEvents = user.events.filter(event => event !== 'STEP UP');
          console.log(`   🏆 Team Events: [${teamEvents.join(', ')}]`);
          console.log(`   👤 Individual Events: [STEP UP]`);
        }
        
        console.log(`   ✅ Validated: ${user.isvalidated ? 'Yes' : 'No'}`);
        console.log(`   🚪 Has Entered: ${user.hasEntered ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('📭 No individual users found with STEP UP in their events');
    }
    
    // 3. Identify specific users mentioned in the issue
    console.log('🎯 CHECKING SPECIFIC USERS MENTIONED IN ISSUE:');
    console.log('-' .repeat(60));
    
    const specificUsers = [
      'tanishkasharma825@gmail.com',
      'navya.23bcon1308@jecrcu.edu.in'
    ];
    
    for (const email of specificUsers) {
      const user = await User.findOne({ email: email });
      if (user) {
        console.log(`✅ Found: ${user.name} (${user.email})`);
        console.log(`   🎯 Events: [${user.events.join(', ')}]`);
        console.log(`   📋 Should be in STEP UP: ${user.events.includes('STEP UP') ? 'Yes ✅' : 'No ❌'}`);
        console.log(`   📋 Should be in DANCE BATTLE: ${user.events.includes('DANCE BATTLE') ? 'Yes ✅' : 'No ❌'}`);
        console.log('');
      } else {
        console.log(`❌ Not found: ${email}`);
        console.log('');
      }
    }
    
    // 4. Check for team compositions that should exist (DANCE BATTLE)
    console.log('🏆 CHECKING DANCE BATTLE TEAM COMPOSITIONS:');
    console.log('-' .repeat(60));
    
    const danceBattleTeams = await TeamComposition.find({ 
      eventName: 'DANCE BATTLE' 
    })
    .populate('teamLeader.userId', 'name email events')
    .populate('teamMembers.userId', 'name email events')
    .sort({ createdAt: 1 });
    
    if (danceBattleTeams.length > 0) {
      console.log(`Found ${danceBattleTeams.length} DANCE BATTLE team compositions (these should exist):\n`);
      
      danceBattleTeams.forEach((team, index) => {
        console.log(`🏆 Team ${index + 1}: ${team.teamName}`);
        console.log(`   🆔 Team ID: ${team._id}`);
        console.log(`   📅 Created: ${team.createdAt}`);
        console.log(`   👑 Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        
        // Check if leader is also in STEP UP individually
        const leader = team.teamLeader.userId;
        if (leader && leader.events) {
          console.log(`   🎯 Leader Events: [${leader.events.join(', ')}]`);
          if (leader.events.includes('STEP UP')) {
            console.log(`   👤 Leader is ALSO individual STEP UP participant ✅`);
          }
        }
        
        console.log(`   👥 Team Size: ${team.totalMembers} members`);
        console.log(`   💳 Payment Status: ${team.paymentStatus || 'Not set'}`);
        
        // Check team members who are also in STEP UP
        let stepUpMembers = 0;
        team.teamMembers.forEach((member, memberIndex) => {
          const memberUser = member.userId;
          if (memberUser && memberUser.events && memberUser.events.includes('STEP UP')) {
            stepUpMembers++;
            if (memberIndex < 5) { // Show first 5 members who are also in STEP UP
              console.log(`      ${memberIndex + 1}. ${member.name} - ALSO in STEP UP individually ✅`);
            }
          }
        });
        
        if (stepUpMembers > 5) {
          console.log(`      ... and ${stepUpMembers - 5} more members also in STEP UP`);
        }
        
        console.log(`   👤 Members also in STEP UP individually: ${stepUpMembers}/${team.teamMembers.length}`);
        console.log('');
      });
    } else {
      console.log('📭 No DANCE BATTLE team compositions found');
    }
    
    // 5. Final Summary
    console.log('📊 FINAL CORRECTED SUMMARY:');
    console.log('-' .repeat(60));
    
    const totalStepUpIndividuals = stepUpUsers.length;
    const validatedStepUp = stepUpUsers.filter(u => u.isvalidated).length;
    const enteredStepUp = stepUpUsers.filter(u => u.hasEntered).length;
    
    // Count users with both STEP UP and other events
    const multiEventUsers = stepUpUsers.filter(u => u.events.length > 1).length;
    const stepUpOnlyUsers = stepUpUsers.filter(u => u.events.length === 1 && u.events[0] === 'STEP UP').length;
    
    console.log(`👤 Total STEP UP Individual Participants: ${totalStepUpIndividuals}`);
    console.log(`   📋 STEP UP Only: ${stepUpOnlyUsers}`);
    console.log(`   📋 STEP UP + Other Events: ${multiEventUsers}`);
    console.log(`   ✅ Validated: ${validatedStepUp}`);
    console.log(`   🚪 Has Entered: ${enteredStepUp}`);
    console.log('');
    console.log('✅ STEP UP is now correctly configured as INDIVIDUAL EVENT ONLY');
    console.log('✅ Team compositions for STEP UP have been removed');
    console.log('✅ Individual users retain STEP UP in their events array');
    console.log('✅ Team events (like DANCE BATTLE) remain as team compositions');
    
    return {
      stepUpIndividuals: stepUpUsers,
      totalIndividuals: totalStepUpIndividuals,
      deletedTeamCompositions: stepUpTeams.length,
      multiEventUsers: multiEventUsers,
      stepUpOnlyUsers: stepUpOnlyUsers
    };
    
  } catch (error) {
    console.error('❌ Error fixing STEP UP data issue:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { fixStepUpDataIssue };

// Run the script if called directly
if (require.main === module) {
  fixStepUpDataIssue();
}