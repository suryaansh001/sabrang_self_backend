const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// MongoDB connection URL - adjust as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang';

const bandMembers = [
  {
    name: "Rohitansh Srivastava",
    contactNo: "8169877659",
    email: "rohitansh.23fe10cii00083@muj.manipal.edu",
    universityIdCard: "m1.jpeg",
    isLeader: false
  },
  {
    name: "Saarang Agarwal",
    contactNo: "8824808981", 
    email: "saarang.23fe10cse00093@muj.manipal.edu",
    universityIdCard: "m2.jpeg",
    isLeader: true
  },
  {
    name: "Ayush Shashi",
    contactNo: "9470305486",
    email: "ayush.229309230@muj.manipal.edu", 
    universityIdCard: "m3.jpeg",
    isLeader: false
  },
  {
    name: "Aryaveer Ralhan",
    contactNo: "8368173222",
    email: "aryaveer6805@gmail.com",
    universityIdCard: "m4.jpeg",
    isLeader: false
  },
  {
    name: "Vedant Patil",
    contactNo: "9370763682",
    email: "vedantmusic485@gmail.com",
    universityIdCard: "m5.jpeg", 
    isLeader: false
  },
  {
    name: "Aditya Ranjan",
    contactNo: "8171935576",
    email: "adityaranjanmuj@gmail.com",
    universityIdCard: "m6.jpeg",
    isLeader: false
  },
  {
    name: "Suryansh Panda", 
    contactNo: "9650200479",
    email: "suryanshpanda2005@gmail.com",
    universityIdCard: "m7.jpeg",
    isLeader: false
  },
  {
    name: "Utkarsh Sharma",
    contactNo: "", // No phone provided
    email: "utkarsh.229301134@muj.manipal.edu",
    universityIdCard: "m8.jpeg", 
    isLeader: false
  }
];

async function generateQRCode(userId) {
  try {
    const qrData = userId.toString();
    const qrCodeBase64 = await QRCode.toDataURL(qrData);
    
    // Remove the data:image/png;base64, prefix
    const base64Data = qrCodeBase64.replace(/^data:image\/png;base64,/, '');
    
    // Save QR code as PNG file
    const qrCodePath = path.join(__dirname, 'app', 'qrcode', `${userId}.png`);
    const qrCodeDir = path.dirname(qrCodePath);
    
    // Ensure directory exists
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }
    
    fs.writeFileSync(qrCodePath, base64Data, 'base64');
    
    return {
      qrCodeBase64: base64Data,
      qrPath: userId.toString()
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    return {
      qrCodeBase64: "",
      qrPath: userId.toString()
    };
  }
}

async function sendEmailToMember(member, userData) {
  try {
    console.log(`\n📧 Sending registration email to ${member.name} (${member.email})...`);
    
    const emailData = {
      name: userData.name,
      events: ['Band Jam'], // Specific to band members
      qrCodeBase64: userData.qrCodeBase64
    };
    
    const emailResult = await sendRegistrationEmail(member.email, emailData);
    
    if (emailResult.success) {
      console.log(`✅ Email sent successfully to ${member.name}`);
      return { success: true, member: member.name };
    } else {
      console.error(`❌ Failed to send email to ${member.name}: ${emailResult.error}`);
      return { success: false, member: member.name, error: emailResult.error };
    }
  } catch (error) {
    console.error(`❌ Error sending email to ${member.name}:`, error.message);
    return { success: false, member: member.name, error: error.message };
  }
}

async function updateEmailStatus(db, userId, emailSuccess, emailError = null) {
  try {
    const updateData = {
      emailSent: emailSuccess,
      emailSentAt: emailSuccess ? new Date() : null,
      emailSentBy: emailSuccess ? 'admin_band_team_script' : null,
      updatedAt: new Date()
    };
    
    if (!emailSuccess && emailError) {
      updateData.emailError = emailError;
    }
    
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );
    
    console.log(`Updated email status for user ${userId}: ${emailSuccess ? 'sent' : 'failed'}`);
  } catch (error) {
    console.error('Error updating email status:', error);
  }
}

async function addBandTeamWithEmails() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    const teamCompositionsCollection = db.collection('teamcompositions');
    
    // Check if team already exists
    const existingTeam = await teamCompositionsCollection.findOne({ teamName: "200ft." });
    if (existingTeam) {
      console.log('Team "200ft." already exists. Checking for email sending...');
      
      // Get existing team members and send emails if not sent
      const existingMembers = await usersCollection.find({
        _id: { $in: existingTeam.members }
      }).toArray();
      
      console.log(`\n📧 Checking email status for ${existingMembers.length} existing members...`);
      const emailResults = [];
      
      for (const existingUser of existingMembers) {
        const memberData = bandMembers.find(m => m.email === existingUser.email);
        if (memberData && !existingUser.emailSent) {
          console.log(`📧 Sending email to existing member: ${existingUser.name}`);
          const emailResult = await sendEmailToMember(memberData, existingUser);
          emailResults.push(emailResult);
          
          // Update email status in database
          await updateEmailStatus(db, existingUser._id, emailResult.success, emailResult.error);
          
          // Add delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (existingUser.emailSent) {
          console.log(`✅ Email already sent to ${existingUser.name}`);
        }
      }
      
      // Print email summary
      console.log('\n=== EMAIL SENDING SUMMARY ===');
      const successfulEmails = emailResults.filter(r => r.success);
      const failedEmails = emailResults.filter(r => !r.success);
      
      console.log(`✅ Successful emails: ${successfulEmails.length}`);
      if (successfulEmails.length > 0) {
        successfulEmails.forEach(result => console.log(`  - ${result.member}`));
      }
      
      console.log(`❌ Failed emails: ${failedEmails.length}`);
      if (failedEmails.length > 0) {
        failedEmails.forEach(result => console.log(`  - ${result.member}: ${result.error}`));
      }
      
      return;
    }
    
    const userIds = [];
    let teamLeaderId = null;
    const emailResults = [];
    
    console.log('\n🚀 Creating users and sending emails...');
    
    // Create users and send emails
    for (const member of bandMembers) {
      console.log(`\n👤 Processing member: ${member.name}`);
      
      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email: member.email });
      if (existingUser) {
        console.log(`User ${member.name} already exists. Using existing user.`);
        userIds.push(existingUser._id);
        if (member.isLeader) {
          teamLeaderId = existingUser._id;
        }
        
        // Send email if not already sent
        if (!existingUser.emailSent) {
          const emailResult = await sendEmailToMember(member, existingUser);
          emailResults.push(emailResult);
          await updateEmailStatus(db, existingUser._id, emailResult.success, emailResult.error);
        } else {
          console.log(`✅ Email already sent to ${member.name}`);
        }
        
        continue;
      }
      
      const userId = new ObjectId();
      const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
      
      // Generate QR code
      console.log(`🔄 Generating QR code for ${member.name}...`);
      const { qrCodeBase64, qrPath } = await generateQRCode(userId);
      
      const userData = {
        _id: userId,
        name: member.name,
        email: member.email,
        password: hashedPassword,
        events: ['Band Jam'],
        isvalidated: false,
        hasEntered: false,
        entryTime: null,
        isAdmin: false,
        profileImage: "",
        universityIdCard: member.universityIdCard,
        contactNo: member.contactNo,
        gender: "",
        age: null,
        universityName: "Manipal University Jaipur", // Assuming based on emails
        address: "",
        referralCode: "",
        userType: "participant",
        supportRole: "",
        governmentId: "",
        idType: "",
        visitorPassDays: 0,
        emailSent: false,
        emailSentAt: null,
        emailSentBy: null,
        teamRegistrations: [],
        registrationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0,
        qrCodeBase64: qrCodeBase64,
        qrPath: qrPath
      };
      
      await usersCollection.insertOne(userData);
      console.log(`✅ Created user: ${member.name}`);
      
      userIds.push(userId);
      if (member.isLeader) {
        teamLeaderId = userId;
      }
      
      // Send registration email
      const emailResult = await sendEmailToMember(member, userData);
      emailResults.push(emailResult);
      
      // Update email status in database
      await updateEmailStatus(db, userId, emailResult.success, emailResult.error);
      
      // Add delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🏆 Creating team composition...');
    
    // Create team composition - you'll need to update this with the correct Band Jam event ID
    const teamCompositionId = new ObjectId();
    const teamData = {
      _id: teamCompositionId,
      teamName: "200ft.",
      teamLeader: teamLeaderId,
      members: userIds,
      eventId: new ObjectId("670b8a3b28b9de36b9b91234"), // Replace with actual Band Jam event ID
      eventName: "Band Jam",
      maxMembers: 8,
      minMembers: 1,
      registrationDate: new Date(),
      isActive: true,
      paymentStatus: "pending",
      registrationFee: 0, // Adjust as needed
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    };
    
    await teamCompositionsCollection.insertOne(teamData);
    console.log('✅ Created team composition for 200ft.');
    
    // Update users with team registration info
    const teamRegistrationData = {
      teamId: teamCompositionId,
      teamName: "200ft.",
      eventId: teamData.eventId,
      eventName: "Band Jam",
      role: "member",
      registrationDate: new Date()
    };
    
    for (const userId of userIds) {
      const updateData = { ...teamRegistrationData };
      if (userId.equals(teamLeaderId)) {
        updateData.role = "leader";
      }
      
      await usersCollection.updateOne(
        { _id: userId },
        { 
          $push: { teamRegistrations: updateData },
          $set: { updatedAt: new Date() }
        }
      );
    }
    
    console.log('✅ Updated all users with team registration info');
    
    // Print comprehensive summary
    console.log('\n=== TEAM CREATION & EMAIL SUMMARY ===');
    console.log(`Team Name: 200ft.`);
    console.log(`Team ID: ${teamCompositionId}`);
    console.log(`Team Leader: Saarang Agarwal (${teamLeaderId})`);
    console.log(`Total Members: ${userIds.length}`);
    
    const successfulEmails = emailResults.filter(r => r.success);
    const failedEmails = emailResults.filter(r => !r.success);
    
    console.log(`\n📧 EMAIL RESULTS:`);
    console.log(`✅ Successful emails: ${successfulEmails.length}`);
    if (successfulEmails.length > 0) {
      successfulEmails.forEach(result => console.log(`  - ${result.member}`));
    }
    
    console.log(`❌ Failed emails: ${failedEmails.length}`);
    if (failedEmails.length > 0) {
      failedEmails.forEach(result => console.log(`  - ${result.member}: ${result.error}`));
    }
    
    console.log('\n🎉 Band team creation and email sending completed!');
    
  } catch (error) {
    console.error('Error adding band team:', error);
  } finally {
    await client.close();
  }
}

// Run the script
addBandTeamWithEmails().catch(console.error);