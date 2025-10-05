const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// MongoDB connection URL - adjust as needed
const MONGODB_URI = "mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang";

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

async function addBandTeam() {
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
      console.log('Team "200ft." already exists. Skipping creation.');
      return;
    }
    
    const userIds = [];
    let teamLeaderId = null;
    
    // Create users
    for (const member of bandMembers) {
      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email: member.email });
      if (existingUser) {
        console.log(`User ${member.name} already exists. Using existing user.`);
        userIds.push(existingUser._id);
        if (member.isLeader) {
          teamLeaderId = existingUser._id;
        }
        continue;
      }
      
      const userId = new ObjectId();
      const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
      
      // Generate QR code
      const { qrCodeBase64, qrPath } = await generateQRCode(userId);
      
      const userData = {
        _id: userId,
        name: member.name,
        email: member.email,
        password: hashedPassword,
        events: [],
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
      console.log(`Created user: ${member.name}`);
      
      userIds.push(userId);
      if (member.isLeader) {
        teamLeaderId = userId;
      }
    }
    
    // Create team composition
    const teamCompositionId = new ObjectId();
    const teamData = {
      _id: teamCompositionId,
      teamName: "200ft.",
      teamLeader: teamLeaderId,
      members: userIds,
      eventId: new ObjectId("670b8a3b28b9de36b9b91234"), // You'll need to replace with actual Band Jam event ID
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
    console.log('Created team composition for 200ft.');
    
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
    
    console.log('Updated all users with team registration info');
    console.log('\n=== TEAM CREATION SUMMARY ===');
    console.log(`Team Name: 200ft.`);
    console.log(`Team ID: ${teamCompositionId}`);
    console.log(`Team Leader: Saarang Agarwal (${teamLeaderId})`);
    console.log(`Total Members: ${userIds.length}`);
    console.log('All members have been added successfully!');
    
  } catch (error) {
    console.error('Error adding band team:', error);
  } finally {
    await client.close();
  }
}

// Run the script
addBandTeam().catch(console.error);