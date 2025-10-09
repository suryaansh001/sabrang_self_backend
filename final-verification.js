/**
 * Final verification of all fixes implemented
 * Check QR codes, events, and overall system status
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

async function finalVerification() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔍 FINAL SYSTEM VERIFICATION');
    console.log('=' .repeat(80));
    
    // 1. Check users with no events
    console.log('\n🎯 CHECKING USERS WITH NO EVENTS:');
    console.log('-' .repeat(60));
    
    const usersWithNoEvents = await User.find({
      $or: [
        { events: { $exists: false } },
        { events: { $size: 0 } }
      ]
    }).select('name email events createdAt');
    
    console.log(`❓ Users with no events: ${usersWithNoEvents.length}`);
    
    if (usersWithNoEvents.length > 0) {
      usersWithNoEvents.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (${user.email})`);
      });
    } else {
      console.log('✅ All users have events assigned!');
    }
    
    // 2. Check QR codes for direct users
    console.log('\n📱 CHECKING QR CODES FOR DIRECT USERS:');
    console.log('-' .repeat(60));
    
    const allUsers = await User.find({}).select('name email qrCodeBase64');
    const usersWithoutQR = allUsers.filter(user => !user.qrCodeBase64);
    
    console.log(`👤 Total direct users: ${allUsers.length}`);
    console.log(`❌ Users without QR codes: ${usersWithoutQR.length}`);
    console.log(`✅ Users with QR codes: ${allUsers.length - usersWithoutQR.length}`);
    
    if (usersWithoutQR.length > 0) {
      console.log('\n⚠️  Users missing QR codes:');
      usersWithoutQR.slice(0, 10).forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (${user.email})`);
      });
      if (usersWithoutQR.length > 10) {
        console.log(`... and ${usersWithoutQR.length - 10} more`);
      }
    }
    
    // 3. Check QR codes for team members
    console.log('\n👥 CHECKING QR CODES FOR TEAM MEMBERS:');
    console.log('-' .repeat(60));
    
    const allTeams = await TeamComposition.find({}).select('teamName teamMembers');
    let totalTeamMembers = 0;
    let teamMembersWithQR = 0;
    let teamMembersWithoutQR = 0;
    
    for (const team of allTeams) {
      if (team.teamMembers) {
        for (const member of team.teamMembers) {
          totalTeamMembers++;
          if (member.qrCodeBase64) {
            teamMembersWithQR++;
          } else {
            teamMembersWithoutQR++;
          }
        }
      }
    }
    
    console.log(`👥 Total team members: ${totalTeamMembers}`);
    console.log(`✅ Team members with QR codes: ${teamMembersWithQR}`);
    console.log(`❌ Team members without QR codes: ${teamMembersWithoutQR}`);
    
    // 4. Check BAND JAM events
    console.log('\n🎵 CHECKING BAND JAM EVENTS:');
    console.log('-' .repeat(60));
    
    // Direct users with BAND JAM
    const directBandJamUsers = await User.find({
      events: { $in: ['BAND JAM', 'BANDJAM'] }
    }).select('name email events');
    
    // Team compositions with BAND JAM
    const bandJamTeams = await TeamComposition.find({
      eventName: { $in: ['BAND JAM', 'BANDJAM'] }
    }).select('teamName eventName teamMembers');
    
    let bandJamTeamMembers = 0;
    bandJamTeams.forEach(team => {
      if (team.teamMembers) {
        bandJamTeamMembers += team.teamMembers.length;
      }
    });
    
    console.log(`👤 Direct users in BAND JAM: ${directBandJamUsers.length}`);
    console.log(`👥 Teams in BAND JAM: ${bandJamTeams.length}`);
    console.log(`👥 Team members in BAND JAM: ${bandJamTeamMembers}`);
    console.log(`🎵 Total BAND JAM participants: ${directBandJamUsers.length + bandJamTeamMembers}`);
    
    // Show BAND JAM teams
    if (bandJamTeams.length > 0) {
      console.log('\n🎵 BAND JAM Teams:');
      bandJamTeams.forEach((team, idx) => {
        console.log(`${idx + 1}. "${team.teamName}" - Event: "${team.eventName}" - Members: ${team.teamMembers ? team.teamMembers.length : 0}`);
      });
    }
    
    // 5. Overall statistics
    console.log('\n📊 OVERALL SYSTEM STATISTICS:');
    console.log('-' .repeat(60));
    
    const totalParticipants = allUsers.length + totalTeamMembers;
    const participantsWithQR = (allUsers.length - usersWithoutQR.length) + teamMembersWithQR;
    const qrPercentage = ((participantsWithQR / totalParticipants) * 100).toFixed(2);
    
    console.log(`👥 Total participants: ${totalParticipants}`);
    console.log(`   - Direct users: ${allUsers.length}`);
    console.log(`   - Team members: ${totalTeamMembers}`);
    console.log(`📱 Participants with QR codes: ${participantsWithQR} (${qrPercentage}%)`);
    console.log(`❌ Participants without QR codes: ${totalParticipants - participantsWithQR}`);
    console.log(`🎯 Users with events: ${allUsers.length - usersWithNoEvents.length}`);
    console.log(`❓ Users without events: ${usersWithNoEvents.length}`);
    
    // 6. Event breakdown
    console.log('\n🎯 EVENT BREAKDOWN:');
    console.log('-' .repeat(60));
    
    const eventStats = {};
    
    // Count direct user events
    for (const user of allUsers) {
      if (user.events && user.events.length > 0) {
        for (const event of user.events) {
          eventStats[event] = (eventStats[event] || 0) + 1;
        }
      }
    }
    
    // Count team events
    for (const team of allTeams) {
      if (team.eventName && team.teamMembers) {
        eventStats[team.eventName] = (eventStats[team.eventName] || 0) + team.teamMembers.length;
      }
    }
    
    const sortedEvents = Object.entries(eventStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    for (const [event, count] of sortedEvents) {
      console.log(`${event}: ${count} participants`);
    }
    
    // 7. Critical issues check
    console.log('\n🚨 CRITICAL ISSUES CHECK:');
    console.log('-' .repeat(60));
    
    const criticalIssues = [];
    
    if (usersWithNoEvents.length > 5) {
      criticalIssues.push(`${usersWithNoEvents.length} users have no events`);
    }
    
    if (usersWithoutQR.length > 0) {
      criticalIssues.push(`${usersWithoutQR.length} direct users missing QR codes`);
    }
    
    if (teamMembersWithoutQR > 0) {
      criticalIssues.push(`${teamMembersWithoutQR} team members missing QR codes`);
    }
    
    if (criticalIssues.length === 0) {
      console.log('✅ No critical issues found!');
    } else {
      console.log('⚠️  Critical issues detected:');
      criticalIssues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue}`);
      });
    }
    
    console.log('\n🔍 FINAL VERIFICATION COMPLETED!');
    
    return {
      totalParticipants,
      participantsWithQR,
      qrPercentage: parseFloat(qrPercentage),
      usersWithoutEvents: usersWithNoEvents.length,
      bandJamParticipants: directBandJamUsers.length + bandJamTeamMembers,
      criticalIssues: criticalIssues.length
    };
    
  } catch (error) {
    console.error('❌ Error in final verification:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { finalVerification };

// Run the script if called directly
if (require.main === module) {
  finalVerification();
}