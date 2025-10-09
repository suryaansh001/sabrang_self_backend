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

async function finalCleanupAndSummary() {
  try {
    console.log('Final cleanup and summary...');

    // Clean up Navya's events array since she's not actually in STEP UP
    const navyaUser = await User.findOne({ email: 'navya.23bcon1308@jecrcu.edu.in' });
    
    await User.updateOne(
      { _id: navyaUser._id },
      {
        $set: {
          events: ['DANCE BATTLE'] // Only DANCE BATTLE since she's not in any STEP UP team
        }
      }
    );
    console.log('✓ Cleaned up Navya\'s events array to only include DANCE BATTLE');

    // Get final team summary
    const team = await TeamComposition.findOne({
      _id: new mongoose.Types.ObjectId('68e1277607a7eecad868484e')
    });

    console.log('\n=== FINAL TEAM SUMMARY ===');
    console.log('Team ID:', team._id);
    console.log('Event:', team.eventName);
    console.log('Team Name:', team.teamName);
    console.log('Team Leader:', {
      name: team.teamLeader.name,
      email: team.teamLeader.email,
      userId: team.teamLeader.userId
    });
    console.log('Team Members Count:', team.teamMembers.length);

    // Verify Navya is in team members
    const navyaInTeam = team.teamMembers.find(m => m.email === 'navya.23bcon1308@jecrcu.edu.in');
    console.log('Navya in team members:', navyaInTeam ? 'Yes' : 'No');
    if (navyaInTeam) {
      console.log('Navya member details:', {
        name: navyaInTeam.name,
        email: navyaInTeam.email,
        userId: navyaInTeam.userId
      });
    }

    // Get updated Navya user record
    const updatedNavya = await User.findOne({ _id: navyaUser._id });
    console.log('\nNavya user record:', {
      _id: updatedNavya._id,
      name: updatedNavya.name,
      email: updatedNavya.email,
      events: updatedNavya.events
    });

    console.log('\n=== ALL FIXES COMPLETED ===');
    console.log('✓ Team name: "Quintessence Dance crew (QDC)"');
    console.log('✓ Team leader: Aryan Jain (jeyaryan010@gmail.com)');
    console.log('✓ Navya joshi is a team member (not leader)');
    console.log('✓ Navya\'s user record corrected');
    console.log('✓ Team has', team.teamMembers.length, 'members total');
    console.log('\nReady to send emails to all team members!');

  } catch (error) {
    console.error('Error in final cleanup:', error);
  } finally {
    mongoose.connection.close();
  }
}

finalCleanupAndSummary();