const mongoose = require('mongoose');

// Simple test without server startup
async function testFlagshipBenefitsLogic() {
  console.log('🧪 Testing flagship benefits processing logic...');
  
  // Sample flagship benefits data similar to what frontend sends
  const sampleFlagshipBenefits = {
    "1": { // Event ID
      supportArtistDetails: [
        {
          name: "Test Support Artist",
          email: "support@test.com",
          contactNo: "9876543210",
          role: "photographer",
          idNumber: "123456789",
          idType: "aadhar"
        },
        {
          name: "Support Artist No Email", // This one has no email
          contactNo: "9876543213",
          role: "videographer"
        }
      ],
      flagshipVisitorPassDetails: [
        {
          name: "Test Visitor",
          collegeMailId: "visitor@test.com",
          contactNo: "9876543211",
          gender: "male",
          age: "22",
          universityName: "Test University",
          address: "Test Address"
        },
        {
          name: "Visitor No Email", // This one has no email
          contactNo: "9876543214",
          gender: "female"
        }
      ],
      flagshipSoloVisitorPassDetails: [
        {
          name: "Test Solo Visitor",
          collegeMailId: "", // Empty email
          contactNo: "9876543212"
        }
      ]
    }
  };

  console.log('Sample flagship benefits:', JSON.stringify(sampleFlagshipBenefits, null, 2));

  // Test processing logic
  const createdSupportStaff = [];
  const createdFlagshipVisitors = [];
  const items = [{ id: 1, title: "BANDJAM" }];

  for (const [eventId, benefits] of Object.entries(sampleFlagshipBenefits)) {
    const eventName = items?.find(item => item.id === parseInt(eventId))?.title || `Event_${eventId}`;
    console.log(`\n🎯 Processing event: ${eventName} (ID: ${eventId})`);
    
    // Process support artists
    if (benefits.supportArtistDetails && Array.isArray(benefits.supportArtistDetails)) {
      console.log(`📊 Found ${benefits.supportArtistDetails.length} support artists`);
      for (const supportArtist of benefits.supportArtistDetails) {
        const supportEmail = supportArtist.email || '';
        const supportName = supportArtist.name || 'Support Staff';
        const supportRole = supportArtist.role || 'support';

        console.log(`  👨‍🎨 Processing support artist: ${supportName} (${supportEmail || 'NO EMAIL'})`);

        if (supportEmail) {
          // Simulate user creation
          const userId = new mongoose.Types.ObjectId();
          
          createdSupportStaff.push({
            userId: userId,
            name: supportName,
            email: supportEmail,
            role: supportRole,
            eventName: eventName,
            hasEntered: false,
            entryTime: null
          });
          
          console.log(`    ✅ Created support staff: ${supportName} with userId: ${userId}`);
        } else {
          console.log(`    ❌ Skipped support artist due to missing email`);
        }
      }
    }

    // Process flagship visitor passes
    if (benefits.flagshipVisitorPassDetails && Array.isArray(benefits.flagshipVisitorPassDetails)) {
      console.log(`📊 Found ${benefits.flagshipVisitorPassDetails.length} flagship visitors`);
      for (const flagshipVisitor of benefits.flagshipVisitorPassDetails) {
        const visitorEmail = flagshipVisitor.collegeMailId || '';
        const visitorName = flagshipVisitor.name || 'Flagship Visitor';

        console.log(`  🎫 Processing flagship visitor: ${visitorName} (${visitorEmail || 'NO EMAIL'})`);

        if (visitorEmail) {
          // Simulate user creation
          const userId = new mongoose.Types.ObjectId();
          
          createdFlagshipVisitors.push({
            userId: userId,
            name: visitorName,
            email: visitorEmail,
            role: 'flagship_visitor',
            eventName: eventName,
            hasEntered: false,
            entryTime: null
          });
          
          console.log(`    ✅ Created flagship visitor: ${visitorName} with userId: ${userId}`);
        } else {
          console.log(`    ❌ Skipped flagship visitor due to missing email`);
        }
      }
    }

    // Process flagship solo visitor passes
    if (benefits.flagshipSoloVisitorPassDetails && Array.isArray(benefits.flagshipSoloVisitorPassDetails)) {
      console.log(`📊 Found ${benefits.flagshipSoloVisitorPassDetails.length} flagship solo visitors`);
      for (const flagshipSoloVisitor of benefits.flagshipSoloVisitorPassDetails) {
        const soloVisitorEmail = flagshipSoloVisitor.collegeMailId || '';
        const soloVisitorName = flagshipSoloVisitor.name || 'Flagship Solo Visitor';

        console.log(`  🎫 Processing flagship solo visitor: ${soloVisitorName} (${soloVisitorEmail || 'NO EMAIL'})`);

        if (soloVisitorEmail) {
          // Simulate user creation
          const userId = new mongoose.Types.ObjectId();
          
          createdFlagshipVisitors.push({
            userId: userId,
            name: soloVisitorName,
            email: soloVisitorEmail,
            role: 'flagship_solo_visitor',
            eventName: eventName,
            hasEntered: false,
            entryTime: null
          });
          
          console.log(`    ✅ Created flagship solo visitor: ${soloVisitorName} with userId: ${userId}`);
        } else {
          console.log(`    ❌ Skipped flagship solo visitor due to missing email`);
        }
      }
    }
  }

  console.log('\n🎯 Final Results:');
  console.log(`📊 Created Support Staff: ${createdSupportStaff.length}`);
  createdSupportStaff.forEach((staff, idx) => {
    console.log(`  ${idx + 1}. ${staff.name} (${staff.email}) - userId: ${staff.userId} - role: ${staff.role}`);
  });

  console.log(`📊 Created Flagship Visitors: ${createdFlagshipVisitors.length}`);
  createdFlagshipVisitors.forEach((visitor, idx) => {
    console.log(`  ${idx + 1}. ${visitor.name} (${visitor.email}) - userId: ${visitor.userId} - role: ${visitor.role}`);
  });

  // Test team composition creation
  const allEventMembers = [...createdSupportStaff, ...createdFlagshipVisitors];
  console.log(`\n🏅 Team Composition Test:`);
  console.log(`👥 Total members for team composition: ${allEventMembers.length}`);
  
  if (allEventMembers.length === 0) {
    console.log(`⚠️ No members created - this could be the issue!`);
    return false;
  }
  
  // Check all members have valid userId
  const membersWithoutUserId = allEventMembers.filter(member => !member.userId);
  if (membersWithoutUserId.length > 0) {
    console.error(`❌ Found ${membersWithoutUserId.length} members without userId:`, membersWithoutUserId);
    return false;
  }
  
  // Additional validation: ensure all userIds are valid ObjectIds
  const membersWithInvalidUserId = allEventMembers.filter(member => {
    try {
      return !mongoose.Types.ObjectId.isValid(member.userId);
    } catch (e) {
      return true;
    }
  });
  
  if (membersWithInvalidUserId.length > 0) {
    console.error(`❌ Found ${membersWithInvalidUserId.length} members with invalid userId:`, membersWithInvalidUserId);
    return false;
  }

  console.log(`✅ All ${allEventMembers.length} members have valid userIds`);
  
  // Test mapping for team composition
  const teamMembers = allEventMembers.map(member => {
    console.log(`🔍 Mapping member:`, { name: member.name, userId: member.userId, type: typeof member.userId });
    return {
      userId: member.userId,
      name: member.name,
      email: member.email,
      hasEntered: false,
      role: member.role || 'member'
    };
  });

  console.log(`✅ Successfully mapped ${teamMembers.length} members for team composition`);
  
  console.log('\n💡 Key insights:');
  console.log('- Only support staff and visitors with valid email addresses are processed');
  console.log('- Missing emails cause entries to be skipped entirely');
  console.log('- This could be why some flagship benefits are not appearing in team compositions');
  
  return true;
}

// Run the test
testFlagshipBenefitsLogic()
  .then(success => {
    console.log(`\n🎯 Test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
