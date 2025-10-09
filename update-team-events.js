const { User, TeamComposition } = require('./models/models');
const mongoose = require('mongoose');
require('dotenv').config();

async function updateTeamEvents() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');

    console.log('🔄 Updating team events to VALORANT TOURNAMENT only...\n');
    console.log('='.repeat(60));

    // Find the specific team by team leader email
    const teamLeaderEmail = 'anshpaul@jklu.edu.in';
    const targetEvent = 'VALORANT TOURNAMENT';
    const eventToRemove = 'BAND JAM';

    console.log(`🎯 Looking for team with leader: ${teamLeaderEmail}`);

    // Step 1: Find the team composition
    const teamComposition = await TeamComposition.findOne({
      'teamLeader.email': teamLeaderEmail
    }).populate('teamLeader.userId').populate('teamMembers.userId');

    if (!teamComposition) {
      console.log('❌ Team not found!');
      return;
    }

    console.log(`✅ Found team: ${teamComposition.teamName} (ID: ${teamComposition._id})`);
    console.log(`📋 Current event: ${teamComposition.eventName}`);

    // Step 2: Update team composition event
    if (teamComposition.eventName !== targetEvent) {
      teamComposition.eventName = targetEvent;
      await teamComposition.save();
      console.log(`✅ Updated team composition event to: ${targetEvent}`);
    } else {
      console.log(`ℹ️ Team composition already has event: ${targetEvent}`);
    }

    // Step 3: Get all team member user IDs including team leader
    const teamLeader = await User.findOne({ email: teamLeaderEmail });
    const teamMemberEmails = teamComposition.teamMembers.map(member => member.email);
    
    console.log(`\n👥 Processing team members (${teamMemberEmails.length + 1} total):`);
    console.log(`👑 Team Leader: ${teamLeader.name} (${teamLeader.email})`);
    teamMemberEmails.forEach((email, index) => {
      console.log(`👤 Member ${index + 1}: ${teamComposition.teamMembers[index].name} (${email})`);
    });

    // Step 4: Update team leader events
    console.log(`\n🔄 Updating team leader events...`);
    console.log(`   Current events: [${teamLeader.events.join(', ')}]`);
    
    let updatedEvents = [...teamLeader.events];
    
    // Remove BAND JAM if present
    if (updatedEvents.includes(eventToRemove)) {
      updatedEvents = updatedEvents.filter(event => event !== eventToRemove);
      console.log(`   ➖ Removed: ${eventToRemove}`);
    }
    
    // Add VALORANT TOURNAMENT if not present
    if (!updatedEvents.includes(targetEvent)) {
      updatedEvents.push(targetEvent);
      console.log(`   ➕ Added: ${targetEvent}`);
    }
    
    teamLeader.events = updatedEvents;
    await teamLeader.save();
    console.log(`   ✅ Updated events for ${teamLeader.name}: [${updatedEvents.join(', ')}]`);

    // Step 5: Update team members events
    console.log(`\n🔄 Updating team members events...`);
    
    for (const memberEmail of teamMemberEmails) {
      const member = await User.findOne({ email: memberEmail });
      
      if (member) {
        console.log(`   Processing: ${member.name} (${member.email})`);
        console.log(`   Current events: [${member.events.join(', ')}]`);
        
        let memberUpdatedEvents = [...member.events];
        
        // Remove BAND JAM if present
        if (memberUpdatedEvents.includes(eventToRemove)) {
          memberUpdatedEvents = memberUpdatedEvents.filter(event => event !== eventToRemove);
          console.log(`   ➖ Removed: ${eventToRemove}`);
        }
        
        // Add VALORANT TOURNAMENT if not present
        if (!memberUpdatedEvents.includes(targetEvent)) {
          memberUpdatedEvents.push(targetEvent);
          console.log(`   ➕ Added: ${targetEvent}`);
        }
        
        member.events = memberUpdatedEvents;
        await member.save();
        console.log(`   ✅ Updated events for ${member.name}: [${memberUpdatedEvents.join(', ')}]`);
      } else {
        console.log(`   ❌ Member not found: ${memberEmail}`);
      }
      console.log('');
    }

    // Step 6: Verification - Check final state
    console.log('🔍 VERIFICATION - Final State:');
    console.log('='.repeat(60));

    // Re-fetch team composition
    const updatedTeamComposition = await TeamComposition.findById(teamComposition._id);
    console.log(`🏗️ Team Composition Event: ${updatedTeamComposition.eventName}`);

    // Re-fetch all users
    const updatedTeamLeader = await User.findOne({ email: teamLeaderEmail });
    console.log(`👑 Team Leader (${updatedTeamLeader.name}): [${updatedTeamLeader.events.join(', ')}]`);

    for (const memberEmail of teamMemberEmails) {
      const updatedMember = await User.findOne({ email: memberEmail });
      if (updatedMember) {
        console.log(`👤 Member (${updatedMember.name}): [${updatedMember.events.join(', ')}]`);
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Team composition updated: ${teamComposition.teamName}`);
    console.log(`✅ Event set to: ${targetEvent}`);
    console.log(`✅ Removed event: ${eventToRemove} (if present)`);
    console.log(`✅ Total users updated: ${teamMemberEmails.length + 1}`);
    console.log(`✅ Team ID: ${teamComposition._id}`);

    console.log('\n🎉 Update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating team events:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  updateTeamEvents()
    .then(() => {
      console.log('\n🎊 Script execution completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { updateTeamEvents };