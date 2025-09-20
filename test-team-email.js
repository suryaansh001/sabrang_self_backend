require('dotenv').config();
const { User, TeamMember, Purchase } = require('./models/models');
const { sendRegistrationEmail, sendTeamMemberEmail } = require('./utils/emailService');
const mongoose = require('mongoose');

async function testTeamEmailFunctionality() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');

    // Find a user with team members
    const userWithTeam = await User.findOne({ 
      isMainPerson: true,
      teamSize: { $gt: 1 }
    }).populate('teamMembers');

    if (!userWithTeam) {
      console.log('❌ No user with team members found. Creating test data...');
      
      // Create a test user
      const testUser = new User({
        name: 'Test Team Leader',
        email: 'teamleader@test.com',
        password: 'hashedpassword',
        events: ['Test Event 1', 'Test Event 2'],
        isMainPerson: true,
        teamSize: 3,
        isvalidated: true,
        qrCodeBase64: 'test-qr-base64'
      });
      await testUser.save();

      // Create test team members with full personal details
      const teamMember1 = new TeamMember({
        mainPersonId: testUser._id,
        name: 'Alice Johnson',
        email: 'alice.johnson@test.com',
        contactNo: '9876543210',
        gender: 'Female',
        age: 22,
        universityName: 'Test University',
        address: '123 Test Street, Test City',
        events: ['Test Event 1', 'Test Event 2'],
        isvalidated: true,
        qrCodeBase64: 'test-qr-base64-alice'
      });

      const teamMember2 = new TeamMember({
        mainPersonId: testUser._id,
        name: 'Bob Smith',
        email: 'bob.smith@test.com',
        contactNo: '9876543211',
        gender: 'Male',
        age: 23,
        universityName: 'Test University',
        address: '456 Test Avenue, Test City',
        events: ['Test Event 1', 'Test Event 2'],
        isvalidated: true,
        qrCodeBase64: 'test-qr-base64-bob'
      });

      await teamMember1.save();
      await teamMember2.save();

      console.log('✅ Test data created');
      console.log(`   - Main User: ${testUser.name} (${testUser.email})`);
      console.log(`   - Team Member 1: ${teamMember1.name} (${teamMember1.email})`);
      console.log(`   - Team Member 2: ${teamMember2.name} (${teamMember2.email})`);

      // Test sending emails to team members
      console.log('\n📧 Testing email sending to team members...');
      
      const teamMembers = await TeamMember.find({ mainPersonId: testUser._id });
      
      for (const member of teamMembers) {
        try {
          const memberEmailData = {
            name: member.name,
            email: member.email,
            contactNo: member.contactNo,
            gender: member.gender,
            age: member.age,
            universityName: member.universityName,
            address: member.address,
            events: member.events,
            qrCodeBase64: member.qrCodeBase64,
            teamLeader: testUser.name
          };

          console.log(`   Sending personalized email to ${member.name} (${member.email})...`);
          const emailResult = await sendTeamMemberEmail(member.email, memberEmailData);
          
          if (emailResult.success) {
            console.log(`   ✅ Email sent successfully to ${member.name}`);
            member.emailSent = true;
            member.emailSentAt = new Date();
            member.emailSentBy = testUser._id;
            await member.save();
          } else {
            console.log(`   ❌ Failed to send email to ${member.name}: ${emailResult.error}`);
          }
          
          // Add delay between emails
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (memberEmailError) {
          console.log(`   ❌ Error sending email to ${member.name}:`, memberEmailError.message);
        }
      }

      console.log('\n✅ Team email functionality test completed!');
      
      // Clean up test data
      console.log('\n🧹 Cleaning up test data...');
      await TeamMember.deleteMany({ mainPersonId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
      console.log('✅ Test data cleaned up');

    } else {
      console.log(`✅ Found user with team: ${userWithTeam.name}`);
      console.log(`   Team size: ${userWithTeam.teamSize}`);
      
      const teamMembers = await TeamMember.find({ mainPersonId: userWithTeam._id });
      console.log(`   Team members: ${teamMembers.length}`);
      
      teamMembers.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.name} (${member.email})`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the test
testTeamEmailFunctionality();
