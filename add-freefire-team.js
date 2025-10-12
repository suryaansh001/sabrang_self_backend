const mongoose = require('mongoose');
const { User, TeamComposition, Event } = require('./models/models');
const qrcode = require('qrcode');
require('dotenv').config();

// Team data
const teamData = {
  eventName: 'FREE FIRE TOURNAMENT',
  teamName: 'FREE FIRE SQUAD',
  leader: {
    name: 'Sangeeth',
    email: 'sangeeth.addepalli@gmail.com',
    contactNo: '8977868159'
  },
  members: [
    {
      name: 'Ashwit',
      email: 'uduthalaashwit@gmail.com',
      contactNo: '9347487107'
    },
    {
      name: 'Shiva',
      email: 'chepyalashivakrishna@gmail.com',
      contactNo: '6303766064'
    },
    {
      name: 'Varun Rampe',
      email: 'varunrampe@gmail.com',
      contactNo: '6300045447'
    }
  ]
};

// Function to generate QR code
async function generateQRCode(userId) {
  try {
    const qrData = userId.toString();
    const qrCodeBase64 = await qrcode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeBase64;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

// Function to create or update user
async function createOrUpdateUser(userData, isLeader = false) {
  try {
    console.log(`\n📝 Processing user: ${userData.name} (${userData.email})`);
    
    // Check if user already exists
    let user = await User.findOne({ email: userData.email });
    let isNewUser = false;
    
    if (!user) {
      console.log(`✨ Creating new user: ${userData.name}`);
      isNewUser = true;
      
      user = new User({
        name: userData.name,
        email: userData.email,
        contactNo: userData.contactNo,
        events: [teamData.eventName],
        isvalidated: true, // Auto-validate for admin-created users
        hasEntered: false,
        userType: 'participant',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await user.save();
      console.log(`✅ User created with ID: ${user._id}`);
    } else {
      console.log(`👤 User exists, updating events: ${userData.name}`);
      
      // Add event if not already registered
      if (!user.events.includes(teamData.eventName)) {
        user.events.push(teamData.eventName);
      }
      
      // Update contact if provided and different
      if (userData.contactNo && user.contactNo !== userData.contactNo) {
        user.contactNo = userData.contactNo;
      }
      
      user.updatedAt = new Date();
      await user.save();
      console.log(`✅ User updated: ${userData.name}`);
    }
    
    // Generate QR code if user doesn't have one
    if (!user.qrCodeBase64) {
      console.log(`🔲 Generating QR code for: ${userData.name}`);
      const qrCodeBase64 = await generateQRCode(user._id);
      if (qrCodeBase64) {
        user.qrCodeBase64 = qrCodeBase64;
        user.qrPath = `qr_${user._id}.png`; // For compatibility
        await user.save();
        console.log(`✅ QR code generated for: ${userData.name}`);
      }
    } else {
      console.log(`🔲 QR code already exists for: ${userData.name}`);
    }
    
    return user;
  } catch (error) {
    console.error(`❌ Error processing user ${userData.name}:`, error.message);
    throw error;
  }
}

// Function to create team composition
async function createTeamComposition(leaderUser, memberUsers) {
  try {
    console.log(`\n🏆 Creating team composition for: ${teamData.teamName}`);
    
    // Check if team already exists for this event
    const existingTeam = await TeamComposition.findOne({
      eventName: teamData.eventName,
      'teamLeader.userId': leaderUser._id
    });
    
    if (existingTeam) {
      console.log(`⚠️  Team already exists for leader ${leaderUser.name}. Updating...`);
      
      // Update existing team
      existingTeam.teamName = teamData.teamName;
      existingTeam.teamLeader = {
        userId: leaderUser._id,
        name: leaderUser.name,
        email: leaderUser.email,
        hasEntered: leaderUser.hasEntered,
        entryTime: leaderUser.entryTime
      };
      
      existingTeam.teamMembers = memberUsers.map(member => ({
        userId: member._id,
        name: member.name,
        email: member.email,
        hasEntered: member.hasEntered,
        entryTime: member.entryTime,
        role: 'Player'
      }));
      
      existingTeam.totalMembers = memberUsers.length + 1; // +1 for leader
      existingTeam.updatedAt = new Date();
      
      await existingTeam.save();
      console.log(`✅ Team updated: ${existingTeam._id}`);
      return existingTeam;
    }
    
    // Create new team composition
    const teamComposition = new TeamComposition({
      eventName: teamData.eventName,
      teamName: teamData.teamName,
      teamLeader: {
        userId: leaderUser._id,
        name: leaderUser.name,
        email: leaderUser.email,
        hasEntered: leaderUser.hasEntered,
        entryTime: leaderUser.entryTime
      },
      teamMembers: memberUsers.map(member => ({
        userId: member._id,
        name: member.name,
        email: member.email,
        hasEntered: member.hasEntered,
        entryTime: member.entryTime,
        role: 'Player'
      })),
      totalMembers: memberUsers.length + 1, // +1 for leader
      maxTeamSize: 4, // FREE FIRE is typically 4 players
      registrationComplete: true,
      paymentStatus: 'completed', // Admin-created, so mark as completed
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await teamComposition.save();
    console.log(`✅ Team composition created: ${teamComposition._id}`);
    
    return teamComposition;
  } catch (error) {
    console.error(`❌ Error creating team composition:`, error.message);
    throw error;
  }
}

// Function to update user team registrations
async function updateUserTeamRegistrations(users, teamComposition, leaderUser) {
  try {
    console.log(`\n🔗 Updating user team registrations...`);
    
    for (const user of users) {
      const isLeader = user._id.toString() === leaderUser._id.toString();
      
      // Check if user already has this team registration
      const existingRegistration = user.teamRegistrations.find(
        reg => reg.eventName === teamData.eventName
      );
      
      if (existingRegistration) {
        // Update existing registration
        existingRegistration.teamName = teamData.teamName;
        existingRegistration.teamLeaderId = leaderUser._id;
        existingRegistration.isTeamLeader = isLeader;
        existingRegistration.teamCompositionId = teamComposition._id;
      } else {
        // Add new registration
        user.teamRegistrations.push({
          eventName: teamData.eventName,
          teamLeaderId: leaderUser._id,
          isTeamLeader: isLeader,
          teamName: teamData.teamName,
          teamCompositionId: teamComposition._id,
          registeredAt: new Date()
        });
      }
      
      user.updatedAt = new Date();
      await user.save();
      console.log(`✅ Updated team registration for: ${user.name} (${isLeader ? 'Leader' : 'Member'})`);
    }
  } catch (error) {
    console.error(`❌ Error updating user team registrations:`, error.message);
    throw error;
  }
}

// Main function
async function addFreefireTeam() {
  try {
    console.log('🚀 Starting FREE FIRE TOURNAMENT team creation...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    // Check if event exists
    const event = await Event.findOne({ name: teamData.eventName });
    if (!event) {
      console.log(`⚠️  Event "${teamData.eventName}" not found. Creating basic event record...`);
      const newEvent = new Event({
        name: teamData.eventName,
        coordinator: 'Gaming Team',
        mobile: '9999999999',
        date: '2025-10-10',
        timings: 'TBD',
        link: '#',
        whatsappLink: '#',
        category: 'Technical',
        description: 'FREE FIRE Gaming Tournament'
      });
      await newEvent.save();
      console.log(`✅ Event created: ${teamData.eventName}`);
    } else {
      console.log(`✅ Event found: ${teamData.eventName}`);
    }
    
    // Step 1: Create/Update leader
    console.log('\n=== STEP 1: Processing Team Leader ===');
    const leaderUser = await createOrUpdateUser(teamData.leader, true);
    
    // Step 2: Create/Update members
    console.log('\n=== STEP 2: Processing Team Members ===');
    const memberUsers = [];
    for (const memberData of teamData.members) {
      const memberUser = await createOrUpdateUser(memberData, false);
      memberUsers.push(memberUser);
    }
    
    // Step 3: Create team composition
    console.log('\n=== STEP 3: Creating Team Composition ===');
    const teamComposition = await createTeamComposition(leaderUser, memberUsers);
    
    // Step 4: Update user team registrations
    console.log('\n=== STEP 4: Updating User Team Registrations ===');
    const allUsers = [leaderUser, ...memberUsers];
    await updateUserTeamRegistrations(allUsers, teamComposition, leaderUser);
    
    // Summary
    console.log('\n🎉 FREE FIRE TOURNAMENT Team Creation Complete!');
    console.log('=====================================');
    console.log(`Team Name: ${teamData.teamName}`);
    console.log(`Event: ${teamData.eventName}`);
    console.log(`Team Leader: ${leaderUser.name} (${leaderUser.email})`);
    console.log(`Team Members: ${memberUsers.length}`);
    memberUsers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.name} (${member.email})`);
    });
    console.log(`Team Composition ID: ${teamComposition._id}`);
    console.log(`Total Team Size: ${teamComposition.totalMembers}`);
    console.log('\n✅ All users have QR codes generated');
    console.log('✅ Team composition created');
    console.log('✅ User team registrations updated');
    console.log('\nTeam is ready for the tournament! 🎮🔥');
    
  } catch (error) {
    console.error('\n❌ Error in team creation process:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addFreefireTeam()
    .then(() => {
      console.log('\n🏁 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addFreefireTeam };