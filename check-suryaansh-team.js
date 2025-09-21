const mongoose = require('mongoose');
require('dotenv').config();

const { User, TeamComposition, Purchase } = require('./models/models');

async function checkSuryaanshTeam() {
  try {
    await mongoose.connect(process.env.mongodb);
    console.log('Connected to MongoDB');

    // Find Suryaansh user
    const suryaansh = await User.findOne({ email: 'suryaanshsharma@jklu.edu.in' });
    console.log('\n=== SURYAANSH USER DATA ===');
    console.log(`Name: ${suryaansh.name}`);
    console.log(`Email: ${suryaansh.email}`);
    console.log(`Events: [${suryaansh.events.join(', ')}]`);
    console.log(`QR Code: ${suryaansh.qrCodeBase64 ? 'YES (' + suryaansh.qrCodeBase64.length + ' chars)' : 'NO'}`);

    // Find BGMI team composition
    const bgmiTeam = await TeamComposition.findOne({ 
      'teamLeader.email': 'suryaanshsharma@jklu.edu.in',
      eventName: 'BGMI TOURNAMENT'
    });

    if (bgmiTeam) {
      console.log('\n=== BGMI TEAM COMPOSITION ===');
      console.log(`Team Name: ${bgmiTeam.teamName}`);
      console.log(`Event: ${bgmiTeam.eventName}`);
      console.log(`Team Leader: ${bgmiTeam.teamLeader.name} (${bgmiTeam.teamLeader.email})`);
      console.log(`Total Members: ${bgmiTeam.totalMembers}`);
      console.log(`Payment Status: ${bgmiTeam.paymentStatus}`);
      console.log(`Created: ${bgmiTeam.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

      console.log('\n=== TEAM MEMBERS ===');
      for (let i = 0; i < bgmiTeam.teamMembers.length; i++) {
        const member = bgmiTeam.teamMembers[i];
        console.log(`${i + 1}. ${member.name} (${member.email}) - Role: ${member.role || 'Member'}`);
        
        // Get the user data for this member
        const memberUser = await User.findById(member.userId);
        if (memberUser) {
          console.log(`   - User ID: ${memberUser._id}`);
          console.log(`   - QR Code: ${memberUser.qrCodeBase64 ? 'YES (' + memberUser.qrCodeBase64.length + ' chars)' : 'NO'}`);
          console.log(`   - Events: [${memberUser.events.join(', ')}]`);
        } else {
          console.log(`   - User data not found for ID: ${member.userId}`);
        }
      }
    } else {
      console.log('\n❌ BGMI Team composition not found');
    }

    // Check all team compositions for this user
    console.log('\n=== ALL TEAM COMPOSITIONS FOR SURYAANSH ===');
    const allTeams = await TeamComposition.find({ 
      'teamLeader.email': 'suryaanshsharma@jklu.edu.in'
    });

    console.log(`Found ${allTeams.length} teams led by Suryaansh:`);
    allTeams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.eventName} - Team: ${team.teamName} - Members: ${team.teamMembers.length} - Payment: ${team.paymentStatus}`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
  }
}

checkSuryaanshTeam();
