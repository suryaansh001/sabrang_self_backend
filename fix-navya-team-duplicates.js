/**
 * Script to Fix Navya Joshi's Team Duplicate Registrations and STEP UP Participants
 * 1. Remove duplicate team registrations
 * 2. Only keep STEP UP for Tanishka Sharma and Navya Joshi
 * 3. Remove STEP UP from other team members who shouldn't have it
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function fixNavyaTeamDuplicatesAndStepUp() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 FIXING NAVYA JOSHI\'S TEAM ISSUES');
    console.log('=' .repeat(80));
    
    // 1. Find all DANCE BATTLE teams with "Navya joshi" as leader
    console.log('🔍 Finding Navya Joshi\'s teams...');
    const navyaTeams = await TeamComposition.find({ 
      eventName: 'DANCE BATTLE',
      $or: [
        { 'teamLeader.email': 'navya.23bcon1308@jecrcu.edu.in' },
        { teamName: { $regex: 'Navya joshi', $options: 'i' } }
      ]
    })
    .populate('teamLeader.userId', 'name email events')
    .populate('teamMembers.userId', 'name email events')
    .sort({ createdAt: 1 });
    
    if (navyaTeams.length > 0) {
      console.log(`\n❌ Found ${navyaTeams.length} teams for Navya Joshi:`);
      
      navyaTeams.forEach((team, index) => {
        console.log(`\n🏆 Team ${index + 1}: ${team.teamName}`);
        console.log(`   🆔 Team ID: ${team._id}`);
        console.log(`   📅 Created: ${team.createdAt}`);
        console.log(`   👑 Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        console.log(`   👥 Team Size: ${team.totalMembers} members`);
        console.log(`   💳 Payment Status: ${team.paymentStatus}`);
        
        // Show some team members
        console.log(`   👥 First 5 Team Members:`);
        team.teamMembers.slice(0, 5).forEach((member, memberIndex) => {
          console.log(`      ${memberIndex + 1}. ${member.name} (${member.email})`);
        });
        if (team.teamMembers.length > 5) {
          console.log(`      ... and ${team.teamMembers.length - 5} more members`);
        }
      });
      
      // Keep the first team (oldest) and remove duplicates
      if (navyaTeams.length > 1) {
        console.log(`\n⚠️  Found ${navyaTeams.length} duplicate teams for Navya Joshi`);
        console.log(`✅ Keeping the first team (created: ${navyaTeams[0].createdAt})`);
        console.log(`❌ Removing ${navyaTeams.length - 1} duplicate team(s)`);
        
        const teamsToDelete = navyaTeams.slice(1); // Remove all except the first one
        
        for (let i = 0; i < teamsToDelete.length; i++) {
          const teamToDelete = teamsToDelete[i];
          console.log(`   🗑️  Deleting duplicate team: ${teamToDelete._id} (created: ${teamToDelete.createdAt})`);
          await TeamComposition.findByIdAndDelete(teamToDelete._id);
        }
        
        console.log(`✅ Deleted ${teamsToDelete.length} duplicate team registrations`);
      } else {
        console.log(`✅ No duplicate teams found for Navya Joshi`);
      }
    } else {
      console.log('📭 No teams found for Navya Joshi');
    }
    
    // 2. Fix STEP UP participants - only Tanishka Sharma and Navya Joshi should have STEP UP
    console.log('\n🎯 FIXING STEP UP PARTICIPANTS FROM NAVYA\'S TEAM');
    console.log('-' .repeat(60));
    
    const correctStepUpEmails = [
      'tanishkasharma825@gmail.com',
      'navya.23bcon1308@jecrcu.edu.in'
    ];
    
    console.log('✅ These users should keep STEP UP:');
    for (const email of correctStepUpEmails) {
      const user = await User.findOne({ email: email });
      if (user) {
        console.log(`   👤 ${user.name} (${user.email}) - Events: [${user.events.join(', ')}]`);
        if (!user.events.includes('STEP UP')) {
          console.log(`   ⚠️  Adding STEP UP to ${user.name}`);
          user.events.push('STEP UP');
          await user.save();
        }
      } else {
        console.log(`   ❌ User not found: ${email}`);
      }
    }
    
    // 3. Find and remove STEP UP from other team members who shouldn't have it
    console.log('\n❌ Removing STEP UP from team members who shouldn\'t have it:');
    
    // Get all users who have both STEP UP and DANCE BATTLE but are NOT in the allowed list
    const usersWithBothEvents = await User.find({
      events: { $all: ['STEP UP', 'DANCE BATTLE'] },
      email: { $nin: correctStepUpEmails }
    });
    
    if (usersWithBothEvents.length > 0) {
      console.log(`\nFound ${usersWithBothEvents.length} users to remove STEP UP from:`);
      
      for (const user of usersWithBothEvents) {
        console.log(`   🔧 ${user.name} (${user.email})`);
        console.log(`      Before: [${user.events.join(', ')}]`);
        
        // Remove STEP UP from events array
        user.events = user.events.filter(event => event !== 'STEP UP');
        await user.save();
        
        console.log(`      After:  [${user.events.join(', ')}]`);
      }
      
      console.log(`✅ Removed STEP UP from ${usersWithBothEvents.length} users who should only be in DANCE BATTLE`);
    } else {
      console.log('✅ No users found with incorrect STEP UP registration');
    }
    
    // 4. Verify the final state
    console.log('\n📊 FINAL VERIFICATION:');
    console.log('-' .repeat(60));
    
    // Check remaining DANCE BATTLE teams for Navya
    const remainingNavyaTeams = await TeamComposition.find({ 
      eventName: 'DANCE BATTLE',
      'teamLeader.email': 'navya.23bcon1308@jecrcu.edu.in'
    });
    
    console.log(`🏆 Remaining DANCE BATTLE teams for Navya: ${remainingNavyaTeams.length}`);
    if (remainingNavyaTeams.length > 0) {
      console.log(`   ✅ Team ID: ${remainingNavyaTeams[0]._id}`);
      console.log(`   ✅ Team Name: ${remainingNavyaTeams[0].teamName}`);
      console.log(`   ✅ Created: ${remainingNavyaTeams[0].createdAt}`);
      console.log(`   ✅ Payment Status: ${remainingNavyaTeams[0].paymentStatus}`);
    }
    
    // Check STEP UP individual participants
    const stepUpUsers = await User.find({ 
      events: 'STEP UP' 
    }).select('name email events').sort({ name: 1 });
    
    console.log(`\n👤 Current STEP UP individual participants: ${stepUpUsers.length}`);
    
    // Show only users from Navya's team context
    console.log('\n🎯 STEP UP participants from Navya\'s team context:');
    const teamContextUsers = stepUpUsers.filter(user => 
      correctStepUpEmails.includes(user.email) || 
      user.events.includes('DANCE BATTLE')
    );
    
    teamContextUsers.forEach((user, index) => {
      const isCorrect = correctStepUpEmails.includes(user.email);
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${isCorrect ? '✅ CORRECT' : '❌ SHOULD NOT HAVE STEP UP'}`);
      console.log(`      Events: [${user.events.join(', ')}]`);
    });
    
    // Count correct vs incorrect
    const correctStepUpUsers = stepUpUsers.filter(user => correctStepUpEmails.includes(user.email));
    const incorrectStepUpUsers = stepUpUsers.filter(user => 
      user.events.includes('DANCE BATTLE') && !correctStepUpEmails.includes(user.email)
    );
    
    console.log(`\n📊 STEP UP Status Summary:`);
    console.log(`   ✅ Correct STEP UP participants from team: ${correctStepUpUsers.length}/2`);
    console.log(`   ❌ Incorrect STEP UP participants from team: ${incorrectStepUpUsers.length}`);
    console.log(`   📋 Total STEP UP participants: ${stepUpUsers.length}`);
    
    if (incorrectStepUpUsers.length === 0) {
      console.log(`\n🎉 SUCCESS: All STEP UP participants are now correctly configured!`);
    } else {
      console.log(`\n⚠️  WARNING: ${incorrectStepUpUsers.length} users still have incorrect STEP UP registration`);
    }
    
    return {
      duplicateTeamsRemoved: navyaTeams.length > 1 ? navyaTeams.length - 1 : 0,
      stepUpCorrected: usersWithBothEvents.length,
      totalStepUpParticipants: stepUpUsers.length,
      correctStepUpFromTeam: correctStepUpUsers.length,
      incorrectStepUpFromTeam: incorrectStepUpUsers.length
    };
    
  } catch (error) {
    console.error('❌ Error fixing Navya team issues:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { fixNavyaTeamDuplicatesAndStepUp };

// Run the script if called directly
if (require.main === module) {
  fixNavyaTeamDuplicatesAndStepUp();
}