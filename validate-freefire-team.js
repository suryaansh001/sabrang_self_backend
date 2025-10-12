const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
require('dotenv').config();

async function validateFreefireTeam() {
  try {
    console.log('🔍 Validating FREE FIRE TOURNAMENT team creation...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');
    
    // Expected team members
    const expectedEmails = [
      'sangeeth.addepalli@gmail.com',     // Leader
      'uduthalaashwit@gmail.com',         // Member 1
      'chepyalashivakrishna@gmail.com',   // Member 2
      'varunrampe@gmail.com'              // Member 3
    ];
    
    console.log('=== VALIDATING INDIVIDUAL USERS ===');
    const foundUsers = [];
    
    for (const email of expectedEmails) {
      const user = await User.findOne({ email: email });
      
      if (user) {
        console.log(`✅ User found: ${user.name} (${user.email})`);
        console.log(`   - ID: ${user._id}`);
        console.log(`   - Contact: ${user.contactNo}`);
        console.log(`   - Events: ${user.events.join(', ')}`);
        console.log(`   - Has QR Code: ${user.qrCodeBase64 ? 'Yes' : 'No'}`);
        console.log(`   - Is Validated: ${user.isvalidated}`);
        console.log(`   - Team Registrations: ${user.teamRegistrations.length}`);
        
        if (user.teamRegistrations.length > 0) {
          user.teamRegistrations.forEach((reg, index) => {
            console.log(`     ${index + 1}. Event: ${reg.eventName}, Role: ${reg.isTeamLeader ? 'Leader' : 'Member'}, Team: ${reg.teamName}`);
          });
        }
        console.log('');
        
        foundUsers.push(user);
      } else {
        console.log(`❌ User NOT found: ${email}\n`);
      }
    }
    
    console.log('=== VALIDATING TEAM COMPOSITION ===');
    
    // Find team composition for FREE FIRE TOURNAMENT
    const teamComposition = await TeamComposition.findOne({ 
      eventName: 'FREE FIRE TOURNAMENT' 
    }).populate('teamLeader.userId').populate('teamMembers.userId');
    
    if (teamComposition) {
      console.log(`✅ Team Composition found: ${teamComposition._id}`);
      console.log(`   - Team Name: ${teamComposition.teamName}`);
      console.log(`   - Event: ${teamComposition.eventName}`);
      console.log(`   - Total Members: ${teamComposition.totalMembers}`);
      console.log(`   - Registration Complete: ${teamComposition.registrationComplete}`);
      console.log(`   - Payment Status: ${teamComposition.paymentStatus}`);
      console.log('');
      
      console.log(`👑 Team Leader:`);
      console.log(`   - Name: ${teamComposition.teamLeader.name}`);
      console.log(`   - Email: ${teamComposition.teamLeader.email}`);
      console.log(`   - User ID: ${teamComposition.teamLeader.userId}`);
      console.log('');
      
      console.log(`👥 Team Members (${teamComposition.teamMembers.length}):`);
      teamComposition.teamMembers.forEach((member, index) => {
        console.log(`   ${index + 1}. Name: ${member.name}`);
        console.log(`      Email: ${member.email}`);
        console.log(`      User ID: ${member.userId}`);
        console.log(`      Role: ${member.role || 'Player'}`);
        console.log('');
      });
    } else {
      console.log(`❌ Team Composition NOT found for FREE FIRE TOURNAMENT`);
    }
    
    console.log('=== VALIDATION SUMMARY ===');
    console.log(`Users in Database: ${foundUsers.length}/4`);
    console.log(`Team Composition: ${teamComposition ? 'Created' : 'Missing'}`);
    
    if (foundUsers.length === 4 && teamComposition) {
      console.log('🎉 SUCCESS: All team members and team composition are properly created!');
      
      // Additional validation - check if all users have the event in their events array
      const usersWithEvent = foundUsers.filter(user => user.events.includes('FREE FIRE TOURNAMENT'));
      console.log(`Users with FREE FIRE TOURNAMENT event: ${usersWithEvent.length}/4`);
      
      // Check if all users have team registrations
      const usersWithTeamReg = foundUsers.filter(user => user.teamRegistrations.length > 0);
      console.log(`Users with team registrations: ${usersWithTeamReg.length}/4`);
      
      // Check QR codes
      const usersWithQR = foundUsers.filter(user => user.qrCodeBase64);
      console.log(`Users with QR codes: ${usersWithQR.length}/4`);
      
      if (usersWithEvent.length === 4 && usersWithTeamReg.length === 4 && usersWithQR.length === 4) {
        console.log('✅ PERFECT: All validations passed! Team is ready for tournament.');
      } else {
        console.log('⚠️  Some users may be missing event registration, team registration, or QR codes.');
      }
    } else {
      console.log('❌ INCOMPLETE: Some team members or team composition are missing.');
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the validation
if (require.main === module) {
  validateFreefireTeam()
    .then(() => {
      console.log('\n🏁 Validation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { validateFreefireTeam };