const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

// Connect to database
async function connectDB() {
  try {
    const mongoUri = process.env.mongodb || 'mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function checkTeamRegistrations() {
  try {
    console.log('\n🔍 Checking Team Registrations in Database');
    console.log('==========================================\n');

    // Get all team compositions
    const teamCompositions = await TeamComposition.find({})
      .populate('teamLeader.userId', 'name email events hasEntered')
      .populate('teamMembers.userId', 'name email events hasEntered')
      .sort({ createdAt: -1 });

    if (teamCompositions.length === 0) {
      console.log('📭 No team registrations found in database');
      return;
    }

    console.log(`📊 Found ${teamCompositions.length} team registrations:\n`);

    teamCompositions.forEach((team, index) => {
      console.log(`🏆 Team ${index + 1}: ${team.teamName}`);
      console.log(`   Team ID: ${team.teamId || 'Not set'}`);
      console.log(`   Event: ${team.eventName}`);
      console.log(`   Registration Complete: ${team.registrationComplete ? '✅' : '❌'}`);
      console.log(`   Payment Status: ${team.paymentStatus}`);
      console.log(`   Created: ${team.createdAt.toLocaleString()}`);
      
      // Team Leader info
      if (team.teamLeader && team.teamLeader.userId) {
        console.log(`\n   👑 Team Leader: ${team.teamLeader.userId.name}`);
        console.log(`      Email: ${team.teamLeader.userId.email}`);
        console.log(`      Events: [${team.teamLeader.userId.events.join(', ')}]`);
        console.log(`      Has Entered: ${team.teamLeader.userId.hasEntered ? '✅' : '❌'}`);
      } else {
        console.log(`\n   👑 Team Leader: ${team.teamLeader.name || 'Unknown'}`);
        console.log(`      Email: ${team.teamLeader.email || 'Unknown'}`);
      }
      
      // Team Members info
      console.log(`\n   👥 Team Members (${team.teamMembers.length}):`);
      team.teamMembers.forEach((member, memberIndex) => {
        if (member.userId) {
          console.log(`      ${memberIndex + 1}. ${member.userId.name} (${member.userId.email})`);
          console.log(`         Events: [${member.userId.events.join(', ')}]`);
          console.log(`         Has Entered: ${member.userId.hasEntered ? '✅' : '❌'}`);
        } else {
          console.log(`      ${memberIndex + 1}. ${member.name || 'Unknown'} (${member.email || 'Unknown'})`);
        }
      });
      
      console.log('\n' + '─'.repeat(80) + '\n');
    });

    // Summary statistics
    const totalTeams = teamCompositions.length;
    const completedRegistrations = teamCompositions.filter(t => t.registrationComplete).length;
    const paidTeams = teamCompositions.filter(t => t.paymentStatus === 'completed').length;
    
    console.log('📈 Summary Statistics:');
    console.log(`   Total Teams: ${totalTeams}`);
    console.log(`   Completed Registrations: ${completedRegistrations}`);
    console.log(`   Paid Teams: ${paidTeams}`);
    console.log(`   Pending Payment: ${totalTeams - paidTeams}`);

    // Event-wise breakdown
    const eventBreakdown = {};
    teamCompositions.forEach(team => {
      if (!eventBreakdown[team.eventName]) {
        eventBreakdown[team.eventName] = 0;
      }
      eventBreakdown[team.eventName]++;
    });

    console.log('\n📅 Event-wise Team Registrations:');
    Object.entries(eventBreakdown).forEach(([event, count]) => {
      console.log(`   ${event}: ${count} teams`);
    });

  } catch (error) {
    console.error('❌ Error checking team registrations:', error);
  }
}

async function checkIndividualUsers() {
  try {
    console.log('\n\n👤 Individual User Registrations');
    console.log('================================\n');

    // Get users with events
    const users = await User.find({ 
      events: { $exists: true, $ne: [] } 
    }).select('name email events hasEntered createdAt').sort({ createdAt: -1 }).limit(10);

    if (users.length === 0) {
      console.log('📭 No individual registrations found');
      return;
    }

    console.log(`📊 Showing latest ${users.length} individual registrations:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Events: [${user.events.join(', ')}]`);
      console.log(`   Has Entered: ${user.hasEntered ? '✅' : '❌'}`);
      console.log(`   Registered: ${user.createdAt.toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking individual users:', error);
  }
}

async function main() {
  await connectDB();
  await checkTeamRegistrations();
  await checkIndividualUsers();
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from database');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkTeamRegistrations, checkIndividualUsers };
