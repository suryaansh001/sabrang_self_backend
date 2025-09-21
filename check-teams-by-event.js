
const mongoose = require('mongoose');
const { User, TeamComposition, Event } = require('./models/models');

async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.mongodb || 'mongodb://localhost:27017/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function getTeamsByEvent() {
  try {
    console.log('🔍 Fetching all team registrations by event...\n');
    
    // Get all team compositions with populated member data
    const teamCompositions = await TeamComposition.find({})
      .populate('teamLeader.userId', 'name email contactNo universityName events')
      .populate('teamMembers.userId', 'name email contactNo universityName events')
      .sort({ eventName: 1, createdAt: 1 });
    
    if (teamCompositions.length === 0) {
      console.log('📭 No team registrations found in the database.');
      return;
    }
    
    // Group teams by event
    const teamsByEvent = {};
    teamCompositions.forEach(team => {
      const eventName = team.eventName;
      if (!teamsByEvent[eventName]) {
        teamsByEvent[eventName] = [];
      }
      teamsByEvent[eventName].push(team);
    });
    
    // Display teams organized by event
    for (const [eventName, teams] of Object.entries(teamsByEvent)) {
      console.log(`🏆 EVENT: ${eventName.toUpperCase()}`);
      console.log('='.repeat(50));
      console.log(`📊 Total Teams: ${teams.length}`);
      console.log(`👥 Total Participants: ${teams.reduce((sum, team) => sum + team.teamMembers.length + 1, 0)}`);
      console.log();
      
      teams.forEach((team, index) => {
        console.log(`${index + 1}. 🏅 TEAM: ${team.teamName || 'Unnamed Team'}`);
        console.log(`   📋 Team ID: ${team.teamId || 'N/A'}`);
        console.log(`   📅 Registered: ${team.createdAt.toLocaleDateString()}`);
        console.log(`   ✅ Registration Complete: ${team.registrationComplete ? 'Yes' : 'No'}`);
        console.log(`   💰 Payment Status: ${team.paymentStatus || 'N/A'}`);
        
        // Team Leader
        const leader = team.teamLeader;
        if (leader && leader.userId) {
          console.log(`   👑 TEAM LEADER:`);
          console.log(`      Name: ${leader.userId.name}`);
          console.log(`      Email: ${leader.userId.email}`);
          console.log(`      Contact: ${leader.userId.contactNo || 'N/A'}`);
          console.log(`      University: ${leader.userId.universityName || 'N/A'}`);
          console.log(`      Events: [${leader.userId.events.join(', ')}]`);
          console.log(`      Entry Status: ${leader.hasEntered ? '✅ Entered' : '⏳ Not Entered'}`);
        } else {
          console.log(`   👑 TEAM LEADER: Data not available`);
        }
        
        // Team Members
        console.log(`   👥 TEAM MEMBERS (${team.teamMembers.length}):`);
        if (team.teamMembers.length === 0) {
          console.log(`      (No additional members)`);
        } else {
          team.teamMembers.forEach((member, memberIndex) => {
            if (member.userId) {
              console.log(`      ${memberIndex + 1}. ${member.userId.name}`);
              console.log(`         Email: ${member.userId.email}`);
              console.log(`         Contact: ${member.userId.contactNo || 'N/A'}`);
              console.log(`         University: ${member.userId.universityName || 'N/A'}`);
              console.log(`         Events: [${member.userId.events.join(', ')}]`);
              console.log(`         Entry Status: ${member.hasEntered ? '✅ Entered' : '⏳ Not Entered'}`);
            } else {
              console.log(`      ${memberIndex + 1}. ${member.name || 'Unknown'} (${member.email || 'No email'})`);
              console.log(`         ⚠️  User data not populated`);
            }
          });
        }
        
        console.log(); // Empty line between teams
      });
      
      console.log('─'.repeat(50));
      console.log();
    }
    
    // Summary
    const totalTeams = teamCompositions.length;
    const totalEvents = Object.keys(teamsByEvent).length;
    const totalParticipants = teamCompositions.reduce((sum, team) => sum + team.teamMembers.length + 1, 0);
    
    console.log('📈 SUMMARY:');
    console.log(`   🎯 Total Events with Teams: ${totalEvents}`);
    console.log(`   🏅 Total Teams: ${totalTeams}`);
    console.log(`   👥 Total Participants: ${totalParticipants}`);
    console.log(`   📊 Average Team Size: ${totalTeams > 0 ? (totalParticipants / totalTeams).toFixed(1) : 0}`);
    
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
  }
}

async function getTeamsBySpecificEvent(eventName) {
  try {
    console.log(`🔍 Fetching teams for event: ${eventName}\n`);
    
    const teams = await TeamComposition.find({ 
      eventName: new RegExp(eventName, 'i') // Case-insensitive search
    })
      .populate('teamLeader.userId', 'name email contactNo universityName events')
      .populate('teamMembers.userId', 'name email contactNo universityName events')
      .sort({ createdAt: 1 });
    
    if (teams.length === 0) {
      console.log(`📭 No teams found for event: ${eventName}`);
      return;
    }
    
    console.log(`🏆 EVENT: ${eventName.toUpperCase()}`);
    console.log('='.repeat(50));
    console.log(`📊 Total Teams: ${teams.length}`);
    console.log(`👥 Total Participants: ${teams.reduce((sum, team) => sum + team.teamMembers.length + 1, 0)}`);
    console.log();
    
    teams.forEach((team, index) => {
      console.log(`${index + 1}. 🏅 ${team.teamName || 'Unnamed Team'}`);
      console.log(`   Team ID: ${team.teamId || 'N/A'}`);
      
      // Team Leader
      const leader = team.teamLeader;
      if (leader && leader.userId) {
        console.log(`   👑 Leader: ${leader.userId.name} (${leader.userId.email})`);
      }
      
      // Team Members
      console.log(`   👥 Members (${team.teamMembers.length}):`);
      team.teamMembers.forEach((member, memberIndex) => {
        if (member.userId) {
          console.log(`      ${memberIndex + 1}. ${member.userId.name} (${member.userId.email})`);
        } else {
          console.log(`      ${memberIndex + 1}. ${member.name || 'Unknown'} (${member.email || 'No email'})`);
        }
      });
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Error fetching teams for specific event:', error);
  }
}

async function main() {
  await connectDB();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // If event name is provided, show only that event
    const eventName = args.join(' ');
    await getTeamsBySpecificEvent(eventName);
  } else {
    // Show all events
    await getTeamsByEvent();
  }
  
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from database');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getTeamsByEvent, getTeamsBySpecificEvent };
