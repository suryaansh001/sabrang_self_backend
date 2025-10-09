const { User, TeamComposition } = require('./models/models');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkMissingQR() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 CHECKING USERS WITHOUT QR CODES...\n');
    console.log('='.repeat(80));

    // Find users without QR codes
    const usersWithoutQR = await User.find({
      $or: [
        { qrPath: { $exists: false } },
        { qrPath: null },
        { qrPath: '' },
        { qrCodeBase64: { $exists: false } },
        { qrCodeBase64: null },
        { qrCodeBase64: '' }
      ]
    }).sort({ createdAt: -1 });

    console.log(`📊 Found ${usersWithoutQR.length} users without QR codes\n`);

    let userCount = 0;
    const missingQRUsers = [];

    for (const user of usersWithoutQR) {
      userCount++;
      
      // Check if user is a team leader or individual
      const teamComposition = await TeamComposition.findOne({ 
        teamLeader: user._id 
      });
      
      const userType = teamComposition ? 'Team Leader' : 'Individual User';
      
      const userInfo = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.contactNo || 'Not provided',
        university: user.universityName || 'Not provided',
        events: user.events || [],
        userType: userType,
        validated: user.isvalidated ? '✅ Yes' : '❌ No',
        qrGenerated: '❌ Not generated',
        emailSent: user.emailSent ? '✅ Yes' : '❌ No',
        created: user.createdAt ? new Date(user.createdAt).toString() : 'Unknown'
      };

      missingQRUsers.push(userInfo);

      console.log(`${userCount}. User Details:`);
      console.log(`   ID: ${userInfo.id}`);
      console.log(`   Name: ${userInfo.name}`);
      console.log(`   Email: ${userInfo.email}`);
      console.log(`   Phone: ${userInfo.phone}`);
      console.log(`   University: ${userInfo.university}`);
      console.log(`   Events: [${userInfo.events.join(', ')}]`);
      console.log(`   Type: ${userInfo.userType}`);
      console.log(`   Validated: ${userInfo.validated}`);
      console.log(`   QR Code: ${userInfo.qrGenerated}`);
      console.log(`   Email Sent: ${userInfo.emailSent}`);
      console.log(`   Created: ${userInfo.created}`);
      console.log('-'.repeat(80));
    }

    console.log('\n🔍 CHECKING TEAM MEMBERS WITHOUT QR CODES...\n');
    console.log('='.repeat(80));

    // Find team members without QR codes
    const teamCompositions = await TeamComposition.find({})
      .populate('teamLeader', 'name email')
      .populate('teamMembers.userId', 'name email contactNo universityName events isvalidated emailSent createdAt qrPath qrCodeBase64');

    let teamMemberCount = 0;
    const missingQRTeamMembers = [];

    for (const team of teamCompositions) {
      for (const member of team.teamMembers) {
        if (member.userId && (!member.userId.qrPath || !member.userId.qrCodeBase64)) {
          teamMemberCount++;
          
          const memberInfo = {
            id: member.userId._id.toString(),
            name: member.userId.name,
            email: member.userId.email,
            phone: member.userId.contactNo || 'Not provided',
            university: member.userId.universityName || 'Not provided',
            events: member.userId.events || [],
            userType: 'Team Member',
            teamName: team.teamName || 'Unknown Team',
            teamLeader: team.teamLeader ? team.teamLeader.name : 'Unknown',
            eventName: team.eventName || 'Unknown Event',
            validated: member.userId.isvalidated ? '✅ Yes' : '❌ No',
            qrGenerated: '❌ Not generated',
            emailSent: member.userId.emailSent ? '✅ Yes' : '❌ No',
            created: member.userId.createdAt ? new Date(member.userId.createdAt).toString() : 'Unknown'
          };

          missingQRTeamMembers.push(memberInfo);

          console.log(`${teamMemberCount}. Team Member Details:`);
          console.log(`   ID: ${memberInfo.id}`);
          console.log(`   Name: ${memberInfo.name}`);
          console.log(`   Email: ${memberInfo.email}`);
          console.log(`   Phone: ${memberInfo.phone}`);
          console.log(`   University: ${memberInfo.university}`);
          console.log(`   Events: [${memberInfo.events.join(', ')}]`);
          console.log(`   Type: ${memberInfo.userType}`);
          console.log(`   Team: ${memberInfo.teamName}`);
          console.log(`   Team Leader: ${memberInfo.teamLeader}`);
          console.log(`   Team Event: ${memberInfo.eventName}`);
          console.log(`   Validated: ${memberInfo.validated}`);
          console.log(`   QR Code: ${memberInfo.qrGenerated}`);
          console.log(`   Email Sent: ${memberInfo.emailSent}`);
          console.log(`   Created: ${memberInfo.created}`);
          console.log('-'.repeat(80));
        }
      }
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`👥 Users without QR codes: ${usersWithoutQR.length}`);
    console.log(`👥 Team members without QR codes: ${teamMemberCount}`);
    console.log(`🎯 Total users needing QR generation: ${usersWithoutQR.length + teamMemberCount}`);

    // Save to JSON files for bulk processing
    const fs = require('fs');
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Save users data
    if (missingQRUsers.length > 0) {
      fs.writeFileSync(
        `missing_qr_users_${timestamp}.json`, 
        JSON.stringify(missingQRUsers, null, 2)
      );
      console.log(`\n💾 Users data saved to: missing_qr_users_${timestamp}.json`);
    }

    // Save team members data
    if (missingQRTeamMembers.length > 0) {
      fs.writeFileSync(
        `missing_qr_team_members_${timestamp}.json`, 
        JSON.stringify(missingQRTeamMembers, null, 2)
      );
      console.log(`💾 Team members data saved to: missing_qr_team_members_${timestamp}.json`);
    }

    // Create a combined list for bulk QR generation
    const allMissingQR = [...missingQRUsers, ...missingQRTeamMembers];
    if (allMissingQR.length > 0) {
      fs.writeFileSync(
        `all_missing_qr_${timestamp}.json`, 
        JSON.stringify(allMissingQR, null, 2)
      );
      console.log(`💾 Combined data saved to: all_missing_qr_${timestamp}.json`);
    }

    // Create CSV for easy viewing
    if (allMissingQR.length > 0) {
      const csvHeaders = 'ID,Name,Email,Phone,University,Events,Type,Validated,QR Generated,Email Sent,Created\n';
      const csvContent = allMissingQR.map(user => 
        `"${user.id}","${user.name}","${user.email}","${user.phone}","${user.university}","${user.events.join('; ')}","${user.userType}","${user.validated}","${user.qrGenerated}","${user.emailSent}","${user.created}"`
      ).join('\n');
      
      fs.writeFileSync(`missing_qr_report_${timestamp}.csv`, csvHeaders + csvContent);
      console.log(`📊 CSV report saved to: missing_qr_report_${timestamp}.csv`);
    }

    console.log('\n✨ Check complete! Use the generated files for bulk QR generation.');

  } catch (error) {
    console.error('❌ Error checking missing QR codes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the check
checkMissingQR();