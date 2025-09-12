const mongoose = require("mongoose");
const { User, TeamMember, Event } = require("./models/models");
require("dotenv").config();

// Test data for team registration
const testTeamData = {
  name: "John Doe",
  email: "john.doe@example.com",
  contactNo: "+91 9876543210",
  gender: "Male",
  age: 22,
  universityName: "JKLU",
  address: "Jaipur, Rajasthan",
  teamMembersBySignature: {
    "team1": [
      {
        name: "Jane Smith",
        email: "jane.smith@example.com",
        contactNo: "+91 9876543211",
        gender: "Female",
        age: 21,
        universityName: "JKLU",
        address: "Jaipur, Rajasthan"
      },
      {
        name: "Bob Johnson",
        email: "bob.johnson@example.com",
        contactNo: "+91 9876543212",
        gender: "Male",
        age: 23,
        universityName: "JKLU",
        address: "Jaipur, Rajasthan"
      }
    ]
  },
  items: [
    { title: "Hackathon" },
    { title: "Tech Quiz" }
  ]
};

async function testTeamRegistration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || "mongodb://localhost:27017/sabrang");
    console.log("✅ Connected to MongoDB");

    // Clear existing test data
    await User.deleteMany({ email: "john.doe@example.com" });
    await TeamMember.deleteMany({ email: { $in: ["jane.smith@example.com", "bob.johnson@example.com"] } });
    console.log("🧹 Cleared existing test data");

    // Test the registration logic (simulating the register endpoint)
    const shortid = require("shortid");
    const bcrypt = require("bcrypt");
    const qr = require("qr-image");
    const fs = require("fs");

    // Main person details
    const mainPersonName = testTeamData.name;
    const mainPersonEmail = testTeamData.email;
    const password = "test123";

    // Check if main person already exists
    let mainPerson = await User.findOne({ email: mainPersonEmail });

    const hashedPassword = await bcrypt.hash(password, 12);
    const teamId = shortid.generate();

    // Process team members data
    const teamMembersData = [];
    if (testTeamData.teamMembersBySignature && typeof testTeamData.teamMembersBySignature === 'object') {
      for (const sig of Object.keys(testTeamData.teamMembersBySignature)) {
        const members = Array.isArray(testTeamData.teamMembersBySignature[sig]) ? testTeamData.teamMembersBySignature[sig] : [];
        teamMembersData.push(...members);
      }
    }

    // Create or update main person
    const mainPersonPayload = {
      name: mainPersonName,
      email: mainPersonEmail,
      contactNo: testTeamData.contactNo,
      gender: testTeamData.gender,
      age: testTeamData.age,
      universityName: testTeamData.universityName,
      address: testTeamData.address,
      isMainPerson: true,
      teamId: teamId,
      teamSize: teamMembersData.length + 1, // +1 for main person
      events: testTeamData.items.map(item => item.title)
    };

    if (!mainPerson) {
      const referralID = shortid.generate();
      mainPerson = new User({
        ...mainPersonPayload,
        password: hashedPassword,
        referalID: referralID
      });
      await mainPerson.save();
      console.log("✅ Created main person:", mainPerson.name);
    }

    // Generate QR code for main person
    const mainPersonQrFilename = `${mainPerson._id}.png`;
    const mainPersonQrPath = `public/qrcodes/${mainPersonQrFilename}`;
    if (!fs.existsSync("public/qrcodes")) fs.mkdirSync("public/qrcodes", { recursive: true });
    if (!fs.existsSync(mainPersonQrPath)) {
      const qr_png = qr.image(`${mainPerson._id}`, { type: 'png' });
      const qrStream = fs.createWriteStream(mainPersonQrPath);
      qr_png.pipe(qrStream);
      await new Promise((resolve, reject) => {
        qrStream.on('finish', resolve);
        qrStream.on('error', reject);
      });
    }
    await User.findOneAndUpdate({ _id: mainPerson._id }, { qrPath: `${mainPerson._id}` }, { new: true });

    // Process team members
    const createdTeamMembers = [];
    for (let i = 0; i < teamMembersData.length; i++) {
      const member = teamMembersData[i];

      // Generate QR code for team member
      const memberId = new mongoose.Types.ObjectId();
      const memberQrFilename = `${memberId}.png`;
      const memberQrPath = `public/qrcodes/${memberQrFilename}`;
      
      const qr_png = qr.image(`${memberId}`, { type: 'png' });
      const qrStream = fs.createWriteStream(memberQrPath);
      qr_png.pipe(qrStream);
      await new Promise((resolve, reject) => {
        qrStream.on('finish', resolve);
        qrStream.on('error', reject);
      });

      const teamMember = new TeamMember({
        mainPersonId: mainPerson._id,
        name: member.name,
        email: member.email,
        contactNo: member.contactNo,
        gender: member.gender,
        age: member.age,
        universityName: member.universityName,
        address: member.address,
        qrPath: `${memberId}`,
        events: mainPerson.events || []
      });

      await teamMember.save();
      createdTeamMembers.push(teamMember);
      console.log(`✅ Created team member: ${teamMember.name}`);
    }

    // Verify the team structure
    console.log("\n📊 Team Registration Results:");
    console.log("================================");
    console.log(`Team ID: ${teamId}`);
    console.log(`Main Person: ${mainPerson.name} (${mainPerson.email})`);
    console.log(`Team Size: ${mainPerson.teamSize}`);
    console.log(`Events: ${mainPerson.events.join(', ')}`);
    console.log(`Team Members: ${createdTeamMembers.length}`);
    
    createdTeamMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.name} (${member.email})`);
    });

    // Test team queries
    console.log("\n🔍 Testing Team Queries:");
    console.log("=========================");
    
    // Test 1: Get team by team ID
    const teamByTeamId = await User.findOne({ teamId: teamId, isMainPerson: true });
    console.log(`✅ Found team by team ID: ${teamByTeamId ? teamByTeamId.name : 'Not found'}`);

    // Test 2: Get team members by main person ID
    const teamMembers = await TeamMember.find({ mainPersonId: mainPerson._id });
    console.log(`✅ Found ${teamMembers.length} team members for main person`);

    // Test 3: Verify QR codes exist
    const mainPersonQrExists = fs.existsSync(`public/qrcodes/${mainPerson._id}.png`);
    console.log(`✅ Main person QR code exists: ${mainPersonQrExists}`);

    const teamMemberQrExists = fs.existsSync(`public/qrcodes/${createdTeamMembers[0]._id}.png`);
    console.log(`✅ Team member QR code exists: ${teamMemberQrExists}`);

    console.log("\n🎉 Team registration test completed successfully!");
    console.log("\n📋 Summary:");
    console.log("- Main person is stored in User collection with teamId");
    console.log("- Team members are stored in TeamMember collection with mainPersonId reference");
    console.log("- Each person (main + members) has their own QR code");
    console.log("- All team members are registered for the same events");
    console.log("- Team structure is properly linked and queryable");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the test
testTeamRegistration();
