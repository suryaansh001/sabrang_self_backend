const mongoose = require('mongoose');
const QRCode = require('qr-image');

// Database connection
mongoose.connect('mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  collegeName: String,
  hasEntered: { type: Boolean, default: false },
  qrCode: String,
  events: [String]
}, { collection: 'users' });

const teamCompositionSchema = new mongoose.Schema({
  eventName: String,
  teamName: String,
  teamLeader: {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String,
    hasEntered: { type: Boolean, default: false }
  },
  teamMembers: [{
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String,
    hasEntered: { type: Boolean, default: false }
  }]
}, { collection: 'teamcompositions' });

const User = mongoose.model('User', userSchema);
const TeamComposition = mongoose.model('TeamComposition', teamCompositionSchema);

// QR Code generation function
function generateUserQRCode(userId) {
  try {
    const qrCodeBuffer = QRCode.imageSync(userId.toString(), { type: 'png' });
    const base64QRCode = qrCodeBuffer.toString('base64');
    return base64QRCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

async function checkAndFixQDCTeamMembers() {
  try {
    console.log('=== CHECKING QDC TEAM MEMBERS ===\n');
    
    // Find the QDC team
    const qdcTeam = await TeamComposition.findOne({
      eventName: 'DANCE BATTLE',
      teamName: 'Quintessence Dance crew (QDC)'
    });

    if (!qdcTeam) {
      console.log('QDC team not found!');
      return;
    }

    console.log('Found QDC team:', {
      teamId: qdcTeam._id,
      teamName: qdcTeam.teamName,
      teamLeader: qdcTeam.teamLeader.name,
      teamMembersCount: qdcTeam.teamMembers?.length || 0
    });

    // Check team leader first
    console.log('\n=== CHECKING TEAM LEADER ===');
    let leaderUser = await User.findOne({ _id: qdcTeam.teamLeader.userId });
    if (!leaderUser) {
      console.log('❌ Team leader not found in users collection!');
      console.log('Creating user record for team leader...');
      leaderUser = new User({
        name: qdcTeam.teamLeader.name,
        email: qdcTeam.teamLeader.email,
        hasEntered: false,
        events: ['DANCE BATTLE']
      });
      await leaderUser.save();
      console.log('✓ Created user record for team leader:', leaderUser._id);
    } else {
      console.log('✓ Team leader found in users collection');
      // Ensure DANCE BATTLE is in events
      if (!leaderUser.events.includes('DANCE BATTLE')) {
        leaderUser.events.push('DANCE BATTLE');
        await leaderUser.save();
        console.log('✓ Added DANCE BATTLE to team leader events');
      }
    }

    // Check QR code for team leader
    if (!leaderUser.qrCode) {
      console.log('❌ Team leader missing QR code, generating...');
      leaderUser.qrCode = generateUserQRCode(leaderUser._id);
      await leaderUser.save();
      console.log('✓ Generated QR code for team leader');
    } else {
      console.log('✓ Team leader has QR code');
    }

    // Check all team members
    console.log('\n=== CHECKING TEAM MEMBERS ===');
    let missingUsers = 0;
    let missingQRCodes = 0;
    let updatedEvents = 0;

    for (let i = 0; i < qdcTeam.teamMembers.length; i++) {
      const member = qdcTeam.teamMembers[i];
      console.log(`\nChecking member ${i + 1}/${qdcTeam.teamMembers.length}: ${member.name}`);
      
      let memberUser = await User.findOne({ _id: member.userId });
      
      if (!memberUser) {
        console.log(`❌ Member ${member.name} not found in users collection!`);
        console.log('Creating user record...');
        memberUser = new User({
          name: member.name,
          email: member.email,
          hasEntered: false,
          events: ['DANCE BATTLE']
        });
        await memberUser.save();
        console.log(`✓ Created user record for ${member.name}: ${memberUser._id}`);
        missingUsers++;
      } else {
        console.log(`✓ Member ${member.name} found in users collection`);
        
        // Ensure DANCE BATTLE is in events
        if (!memberUser.events.includes('DANCE BATTLE')) {
          memberUser.events.push('DANCE BATTLE');
          await memberUser.save();
          console.log(`✓ Added DANCE BATTLE to ${member.name} events`);
          updatedEvents++;
        }
      }

      // Check QR code
      if (!memberUser.qrCode) {
        console.log(`❌ Member ${member.name} missing QR code, generating...`);
        memberUser.qrCode = generateUserQRCode(memberUser._id);
        await memberUser.save();
        console.log(`✓ Generated QR code for ${member.name}`);
        missingQRCodes++;
      } else {
        console.log(`✓ Member ${member.name} has QR code`);
      }
    }

    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log('Team Name: Quintessence Dance crew (QDC)');
    console.log('Event: DANCE BATTLE');
    console.log('Team Leader:', qdcTeam.teamLeader.name, '(' + qdcTeam.teamLeader.email + ')');
    console.log('Total Team Members:', qdcTeam.teamMembers.length);
    console.log('\n--- Actions Taken ---');
    console.log('Missing users created:', missingUsers);
    console.log('Missing QR codes generated:', missingQRCodes + (leaderUser.qrCode ? 0 : 1));
    console.log('Events updated:', updatedEvents);

    // Verify final state
    console.log('\n=== VERIFICATION ===');
    const allTeamUserIds = [qdcTeam.teamLeader.userId, ...qdcTeam.teamMembers.map(m => m.userId)];
    const allUsers = await User.find({ _id: { $in: allTeamUserIds } });
    
    console.log('Total users in database for this team:', allUsers.length);
    console.log('Users with QR codes:', allUsers.filter(u => u.qrCode).length);
    console.log('Users with DANCE BATTLE event:', allUsers.filter(u => u.events.includes('DANCE BATTLE')).length);

    if (allUsers.length === allTeamUserIds.length && 
        allUsers.every(u => u.qrCode) && 
        allUsers.every(u => u.events.includes('DANCE BATTLE'))) {
      console.log('\n🎉 ALL TEAM MEMBERS ARE PROPERLY SET UP!');
      console.log('✓ All members exist in users collection');
      console.log('✓ All members have QR codes');
      console.log('✓ All members have DANCE BATTLE in their events');
    } else {
      console.log('\n⚠️ Some issues still remain. Please review the above details.');
    }

  } catch (error) {
    console.error('Error checking team members:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAndFixQDCTeamMembers();