const mongoose = require('mongoose');

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

async function showCompleteTeamStatus() {
  try {
    console.log('=== QUINTESSENCE DANCE CREW (QDC) - COMPLETE STATUS ===\n');
    
    // Find the QDC team
    const qdcTeam = await TeamComposition.findOne({
      eventName: 'DANCE BATTLE',
      teamName: 'Quintessence Dance crew (QDC)'
    });

    if (!qdcTeam) {
      console.log('QDC team not found!');
      return;
    }

    console.log('📋 TEAM INFORMATION:');
    console.log('Team ID:', qdcTeam._id);
    console.log('Event:', qdcTeam.eventName);
    console.log('Team Name:', qdcTeam.teamName);
    console.log('Total Members (including leader):', qdcTeam.teamMembers.length + 1);

    // Get team leader details
    const leaderUser = await User.findOne({ _id: qdcTeam.teamLeader.userId });
    console.log('\n👑 TEAM LEADER:');
    console.log('Name:', qdcTeam.teamLeader.name);
    console.log('Email:', qdcTeam.teamLeader.email);
    console.log('User ID:', qdcTeam.teamLeader.userId);
    console.log('Has QR Code:', leaderUser?.qrCode ? '✅ Yes' : '❌ No');
    console.log('Events:', leaderUser?.events || []);

    // Get all team members details
    console.log('\n👥 TEAM MEMBERS:');
    for (let i = 0; i < qdcTeam.teamMembers.length; i++) {
      const member = qdcTeam.teamMembers[i];
      const memberUser = await User.findOne({ _id: member.userId });
      
      console.log(`\n${i + 1}. ${member.name}`);
      console.log('   Email:', member.email);
      console.log('   User ID:', member.userId);
      console.log('   Has QR Code:', memberUser?.qrCode ? '✅ Yes' : '❌ No');
      console.log('   Events:', memberUser?.events || []);
    }

    // Summary statistics
    const allTeamUserIds = [qdcTeam.teamLeader.userId, ...qdcTeam.teamMembers.map(m => m.userId)];
    const allUsers = await User.find({ _id: { $in: allTeamUserIds } });
    
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log('Total team size:', allTeamUserIds.length);
    console.log('Users in database:', allUsers.length);
    console.log('Users with QR codes:', allUsers.filter(u => u.qrCode).length);
    console.log('Users with DANCE BATTLE event:', allUsers.filter(u => u.events.includes('DANCE BATTLE')).length);
    console.log('Users with email addresses:', allUsers.filter(u => u.email).length);

    // Check for any issues
    console.log('\n🔍 HEALTH CHECK:');
    const missingFromDB = allTeamUserIds.length - allUsers.length;
    const missingQR = allUsers.filter(u => !u.qrCode).length;
    const missingEvent = allUsers.filter(u => !u.events.includes('DANCE BATTLE')).length;
    const missingEmail = allUsers.filter(u => !u.email).length;

    if (missingFromDB === 0 && missingQR === 0 && missingEvent === 0 && missingEmail === 0) {
      console.log('🎉 PERFECT! All team members are properly configured!');
      console.log('✅ All members exist in users collection');
      console.log('✅ All members have QR codes generated');
      console.log('✅ All members have DANCE BATTLE in their events');
      console.log('✅ All members have email addresses');
      console.log('\n🚀 READY FOR EMAIL CAMPAIGN!');
    } else {
      console.log('⚠️ Issues found:');
      if (missingFromDB > 0) console.log(`   - ${missingFromDB} members missing from users collection`);
      if (missingQR > 0) console.log(`   - ${missingQR} members missing QR codes`);
      if (missingEvent > 0) console.log(`   - ${missingEvent} members missing DANCE BATTLE event`);
      if (missingEmail > 0) console.log(`   - ${missingEmail} members missing email addresses`);
    }

  } catch (error) {
    console.error('Error showing team status:', error);
  } finally {
    mongoose.connection.close();
  }
}

showCompleteTeamStatus();