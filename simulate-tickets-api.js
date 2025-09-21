const mongoose = require('mongoose');
require('dotenv').config();

const { User, TeamComposition, Event } = require('./models/models');

async function simulateTicketsAPI() {
  try {
    await mongoose.connect(process.env.mongodb);
    console.log('Connected to MongoDB');

    const email = 'suryaanshsharma@jklu.edu.in';

    // Simulate the exact logic from api.js /team-by-email
    const user = await User.findOne({ 
      email: email.toLowerCase().trim()
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    // Get team compositions where this user is team leader
    const teamCompositions = await TeamComposition.find({ 
      'teamLeader.userId': user._id 
    });

    console.log(`Found ${teamCompositions.length} team compositions`);

    // Get events data for user's registered events
    const events = user.events;
    const eventData = [];
    for (let i = 0; i < events.length; i++) {
      const info = await Event.findOne({ name: events[i] });
      if (info) {
        eventData.push(info);
      }
    }

    // Build registrations array exactly like api.js
    const registrations = [];
    let registrationCount = 1;

    // Check if user has individual registrations
    const teamEventNames = teamCompositions.map(team => team.eventName);
    const individualEvents = user.events.filter(eventName => !teamEventNames.includes(eventName));

    console.log('\n=== API SIMULATION RESULTS ===');
    console.log(`User events: [${user.events.join(', ')}]`);
    console.log(`Team event names: [${teamEventNames.join(', ')}]`);
    console.log(`Individual events: [${individualEvents.join(', ')}]`);

    // Focus on BGMI TOURNAMENT team
    const bgmiTeam = teamCompositions.find(team => team.eventName === 'BGMI TOURNAMENT');
    
    if (bgmiTeam) {
      console.log('\n=== BGMI TEAM API RESPONSE ===');
      
      const teamMembers = await Promise.all(bgmiTeam.teamMembers.map(async (member) => {
        const memberUser = await User.findById(member.userId);
        return {
          id: member.userId,
          name: member.name,
          email: member.email,
          contactNo: memberUser?.contactNo || '',
          gender: memberUser?.gender || '',
          age: memberUser?.age || 0,
          universityName: memberUser?.universityName || '',
          address: memberUser?.address || '',
          profileImage: memberUser?.profileImage || '',
          qrPath: memberUser?.qrPath || '',
          qrCodeBase64: memberUser?.qrCodeBase64 || '',
          hasEntered: member.hasEntered,
          entryTime: member.entryTime,
          events: [bgmiTeam.eventName],
          role: member.role || ''
        };
      }));

      console.log(`Team Name: ${bgmiTeam.teamName}`);
      console.log(`Event: ${bgmiTeam.eventName}`);
      console.log(`Team Size: ${bgmiTeam.totalMembers}`);
      console.log(`Team Members:`);
      
      teamMembers.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name} (${member.email})`);
        console.log(`     - QR Code: ${member.qrCodeBase64 ? 'YES (' + member.qrCodeBase64.length + ' chars)' : 'NO'}`);
        console.log(`     - QR Path: ${member.qrPath || 'empty'}`);
      });

      // Leader QR
      console.log(`\nTeam Leader QR:`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - QR Code: ${user.qrCodeBase64 ? 'YES (' + user.qrCodeBase64.length + ' chars)' : 'NO'}`);
      console.log(`  - QR Path: ${user.qrPath || 'empty'}`);
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
  }
}

simulateTicketsAPI();
