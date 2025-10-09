const { User, TeamComposition } = require('./models/models');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Team data
const TEAM_DATA = {
  eventName: "VALORANT TOURNAMENT",
  teamName: "WCP",
  teamLeader: {
    name: "ANSH PAUL",
    email: "anshpaul@jklu.edu.in",
    contactNo: "9424446681"
  },
  teamMembers: [
    {
      name: "Devam Gupta",
      email: "devamgupta@jklu.edu.in",
      contactNo: "7340015201"
    },
    {
      name: "Rakshit Khandelwal",
      email: "rakshitkhandelwal2404@gmail.com",
      contactNo: "7849999713"
    },
    {
      name: "Garvit Agrawal",
      email: "garvitagrawal@jklu.edu.in",
      contactNo: "9024079027"
    },
    {
      name: "Prashant Singh",
      email: "prashantsingh@jklu.edu.in",
      contactNo: "8302840321"
    }
  ]
};

async function generateQRCode(user) {
  try {
    // Create QR directory if it doesn't exist
    const qrDir = path.join(__dirname, 'qr_codes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Generate QR code data
    const qrData = JSON.stringify({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      events: user.events || []
    });

    // Generate QR code as base64
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    // Save QR code as file
    const fileName = `qr_${user._id}.png`;
    const filePath = path.join(qrDir, fileName);
    const qrRelativePath = `qr_codes/${fileName}`;

    // Convert base64 to buffer and save
    const base64Data = qrCodeBase64.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');

    // Update user with QR code info
    user.qrPath = qrRelativePath;
    user.qrCodeBase64 = qrCodeBase64;
    await user.save();

    console.log(`   ✅ QR code generated for ${user.name}`);
    return { success: true, qrPath: qrRelativePath, qrCodeBase64 };

  } catch (error) {
    console.log(`   ❌ QR generation failed for ${user.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function sendUserEmail(user) {
  try {
    const userData = {
      name: user.name,
      events: user.events || [],
      qrCodeBase64: user.qrCodeBase64
    };

    const emailResult = await sendRegistrationEmail(user.email, userData);

    if (emailResult.success) {
      user.emailSent = true;
      user.emailSentAt = new Date();
      await user.save();
      console.log(`   ✅ Registration email sent to ${user.name} (${user.email})`);
      return { success: true };
    } else {
      console.log(`   ❌ Email failed for ${user.name}: ${emailResult.error}`);
      return { success: false, error: emailResult.error };
    }

  } catch (error) {
    console.log(`   ❌ Email error for ${user.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function createOrUpdateUser(userData, isTeamLeader = false) {
  try {
    console.log(`🔍 Processing user: ${userData.name} (${userData.email})`);

    // Check if user already exists
    let user = await User.findOne({ email: userData.email });
    
    if (user) {
      console.log(`   👤 User already exists: ${user.name}`);
      
      // Update events if BAND JAM is not already in the list
      if (!user.events.includes(TEAM_DATA.eventName)) {
        user.events.push(TEAM_DATA.eventName);
        user.isMainPerson = isTeamLeader;
        await user.save();
        console.log(`   ✅ Added ${TEAM_DATA.eventName} to user's events`);
      }
    } else {
      // Create new user
      console.log(`   ➕ Creating new user: ${userData.name}`);
      
      user = new User({
        name: userData.name,
        email: userData.email,
        contactNo: userData.contactNo,
        universityName: "JK Lakshmipat University", // Default for JKLU emails
        address: "",
        gender: "",
        age: null,
        profileImage: "",
        events: [TEAM_DATA.eventName],
        isMainPerson: isTeamLeader,
        teamId: null, // Will be set after team creation
        teamSize: isTeamLeader ? 5 : 0, // Team leader + 4 members
        isvalidated: false,
        hasEntered: false,
        emailSent: false,
        userType: "participant",
        finalPrice: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await user.save();
      console.log(`   ✅ User created successfully`);
    }

    return user;

  } catch (error) {
    console.error(`   ❌ Error processing user ${userData.name}:`, error.message);
    throw error;
  }
}

async function createTeamWithUsers() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');

    console.log('� Creating VALORANT TOURNAMENT team with users...\n');
    console.log('='.repeat(60));

    // Step 1: Create or update team leader
    console.log('👑 PROCESSING TEAM LEADER');
    const teamLeader = await createOrUpdateUser(TEAM_DATA.teamLeader, true);
    
    // Step 2: Create or update team members
    console.log('\n👥 PROCESSING TEAM MEMBERS');
    const teamMembers = [];
    
    for (const memberData of TEAM_DATA.teamMembers) {
      const member = await createOrUpdateUser(memberData, false);
      teamMembers.push(member);
    }

    // Step 3: Create team composition
    console.log('\n🏗️ CREATING TEAM COMPOSITION');
    
    // Check if team already exists
    const existingTeam = await TeamComposition.findOne({
      eventName: TEAM_DATA.eventName,
      'teamLeader.email': teamLeader.email
    });

    let teamComposition;
    
    if (existingTeam) {
      console.log('   👥 Team already exists, updating...');
      teamComposition = existingTeam;
    } else {
      console.log('   ➕ Creating new team composition...');
      
      teamComposition = new TeamComposition({
        eventName: TEAM_DATA.eventName,
        teamName: TEAM_DATA.teamName,
        teamLeader: {
          userId: teamLeader._id,
          name: teamLeader.name,
          email: teamLeader.email,
          hasEntered: false
        },
        teamMembers: teamMembers.map(member => ({
          userId: member._id,
          name: member.name,
          email: member.email,
          hasEntered: false,
          role: "member"
        })),
        totalMembers: teamMembers.length + 1, // Including team leader
        maxTeamSize: 10,
        registrationComplete: true,
        teamEntryStatus: {
          totalEntered: 0,
          pendingEntry: teamMembers.length + 1,
          allEntered: false
        },
        paymentStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await teamComposition.save();
    }

    console.log(`   ✅ Team composition created/updated: ${teamComposition._id}`);

    // Step 4: Update users with team ID
    console.log('\n🔗 UPDATING USERS WITH TEAM ID');
    const teamId = teamComposition._id.toString();
    
    teamLeader.teamId = teamId;
    await teamLeader.save();
    console.log(`   ✅ Team leader updated with teamId: ${teamId}`);

    for (const member of teamMembers) {
      member.teamId = teamId;
      await member.save();
      console.log(`   ✅ Member ${member.name} updated with teamId: ${teamId}`);
    }

    // Step 5: Generate QR codes
    console.log('\n🎯 GENERATING QR CODES');
    
    const allUsers = [teamLeader, ...teamMembers];
    const qrResults = [];

    for (const user of allUsers) {
      if (!user.qrCodeBase64 || !user.qrPath) {
        console.log(`   🔄 Generating QR for ${user.name}...`);
        const qrResult = await generateQRCode(user);
        qrResults.push({ user: user.name, ...qrResult });
      } else {
        console.log(`   ✅ QR already exists for ${user.name}`);
        qrResults.push({ user: user.name, success: true, existing: true });
      }
    }

    // Step 6: Send registration emails
    console.log('\n📧 SENDING REGISTRATION EMAILS');
    
    const emailResults = [];

    for (const user of allUsers) {
      if (!user.emailSent && user.qrCodeBase64) {
        console.log(`   📤 Sending email to ${user.name}...`);
        const emailResult = await sendUserEmail(user);
        emailResults.push({ user: user.name, ...emailResult });
        
        // Add delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        const reason = !user.qrCodeBase64 ? 'no QR code' : 'already sent';
        console.log(`   ⏭️ Skipping email for ${user.name} (${reason})`);
        emailResults.push({ user: user.name, success: true, skipped: true, reason });
      }
    }

    // Step 7: Summary
    console.log('\n📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎵 Event: ${TEAM_DATA.eventName}`);
    console.log(`👑 Team: ${TEAM_DATA.teamName}`);
    console.log(`👥 Team ID: ${teamId}`);
    console.log(`👤 Team Leader: ${teamLeader.name} (${teamLeader.email})`);
    console.log(`👥 Team Members: ${teamMembers.length}`);
    
    console.log('\n🎯 QR Code Results:');
    qrResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const extra = result.existing ? ' (existing)' : result.error ? ` (${result.error})` : '';
      console.log(`   ${status} ${result.user}${extra}`);
    });

    console.log('\n📧 Email Results:');
    emailResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const extra = result.skipped ? ` (skipped: ${result.reason})` : result.error ? ` (${result.error})` : '';
      console.log(`   ${status} ${result.user}${extra}`);
    });

    const successfulQR = qrResults.filter(r => r.success).length;
    const successfulEmails = emailResults.filter(r => r.success).length;

    console.log('\n🎉 FINAL RESULTS:');
    console.log(`   👥 Users processed: ${allUsers.length}`);
    console.log(`   🎯 QR codes: ${successfulQR}/${qrResults.length} successful`);
    console.log(`   📧 Emails: ${successfulEmails}/${emailResults.length} successful`);
    console.log(`   🏗️ Team created/updated: ${teamComposition._id}`);

    console.log('\n✨ Team creation process completed!');

    return {
      teamComposition,
      teamLeader,
      teamMembers,
      qrResults,
      emailResults
    };

  } catch (error) {
    console.error('❌ Error in team creation process:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  createTeamWithUsers()
    .then(result => {
      console.log('\n🎊 Script execution completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { createTeamWithUsers, TEAM_DATA };