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

async function verifyUpdate() {
  try {
    console.log('Verifying the updated DANCE BATTLE team...');
    
    // Find the team by ObjectId
    const team = await TeamComposition.findOne({
      _id: new mongoose.Types.ObjectId('68e1277607a7eecad868484e')
    });

    if (!team) {
      console.log('Team not found!');
      return;
    }

    console.log('\n=== UPDATED TEAM DETAILS ===');
    console.log('Team ID:', team._id);
    console.log('Event Name:', team.eventName);
    console.log('Team Name:', team.teamName);
    console.log('Team Leader:');
    console.log('  - User ID:', team.teamLeader.userId);
    console.log('  - Name:', team.teamLeader.name);
    console.log('  - Email:', team.teamLeader.email);
    console.log('  - Has Entered:', team.teamLeader.hasEntered);
    console.log('Team Members Count:', team.teamMembers?.length || 0);

    // Also check the new team leader's user record
    const aryanUser = await User.findOne({ 
      _id: team.teamLeader.userId 
    });

    if (aryanUser) {
      console.log('\n=== NEW TEAM LEADER USER RECORD ===');
      console.log('User ID:', aryanUser._id);
      console.log('Name:', aryanUser.name);
      console.log('Email:', aryanUser.email);
      console.log('Events:', aryanUser.events);
      console.log('Has QR Code:', aryanUser.qrCode ? 'Yes' : 'No');
    }

    // Check if old Navya user record was updated
    const navyaUser = await User.findOne({ 
      email: 'navya.23bcon1308@jecrcu.edu.in' 
    });

    if (navyaUser) {
      console.log('\n=== PREVIOUS TEAM LEADER (NAVYA) USER RECORD ===');
      console.log('User ID:', navyaUser._id);
      console.log('Name:', navyaUser.name);
      console.log('Email:', navyaUser.email);
      console.log('Events:', navyaUser.events);
      console.log('Note: DANCE BATTLE should be removed if she\'s not in other DANCE BATTLE teams');
    }

  } catch (error) {
    console.error('Error verifying update:', error);
  } finally {
    mongoose.connection.close();
  }
}

verifyUpdate();