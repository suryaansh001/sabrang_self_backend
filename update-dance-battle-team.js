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

async function updateDanceBattleTeam() {
  try {
    console.log('Finding the DANCE BATTLE team with Navya Joshi...');
    
    // Find the specific team
    const team = await TeamComposition.findOne({
      eventName: 'DANCE BATTLE',
      teamName: "Navya joshi's Team",
      'teamLeader.name': 'Navya joshi'
    });

    if (!team) {
      console.log('Team not found!');
      return;
    }

    console.log('Found team:', {
      _id: team._id,
      eventName: team.eventName,
      teamName: team.teamName,
      teamLeader: team.teamLeader,
      teamMembers: team.teamMembers?.length || 0
    });

    // Check if Aryan Jain already exists as a user
    let aryanUser = await User.findOne({ email: 'jeyaryan010@gmail.com' });
    
    if (!aryanUser) {
      console.log('Creating new user for Aryan Jain...');
      aryanUser = new User({
        name: 'Aryan Jain',
        email: 'jeyaryan010@gmail.com',
        hasEntered: false,
        events: ['DANCE BATTLE']
      });
      await aryanUser.save();
      console.log('Created new user for Aryan Jain:', aryanUser._id);
    } else {
      console.log('Found existing user for Aryan Jain:', aryanUser._id);
      // Add DANCE BATTLE to events if not already present
      if (!aryanUser.events.includes('DANCE BATTLE')) {
        aryanUser.events.push('DANCE BATTLE');
        await aryanUser.save();
        console.log('Added DANCE BATTLE to Aryan\'s events');
      }
    }

    // Update the team
    const updateResult = await TeamComposition.updateOne(
      { _id: team._id },
      {
        $set: {
          teamName: 'Quintessence Dance crew (QDC)',
          'teamLeader.userId': aryanUser._id,
          'teamLeader.name': 'Aryan Jain',
          'teamLeader.email': 'jeyaryan010@gmail.com',
          'teamLeader.hasEntered': false
        }
      }
    );

    console.log('Update result:', updateResult);

    // Verify the update
    const updatedTeam = await TeamComposition.findOne({ _id: team._id });
    console.log('Updated team details:', {
      _id: updatedTeam._id,
      eventName: updatedTeam.eventName,
      teamName: updatedTeam.teamName,
      teamLeader: updatedTeam.teamLeader,
      teamMembers: updatedTeam.teamMembers?.length || 0
    });

    // Check if old Navya user should be updated (remove DANCE BATTLE from events if she's not in other teams)
    const navyaUser = await User.findOne({ _id: team.teamLeader.userId });
    if (navyaUser) {
      console.log('Checking Navya\'s other team participations...');
      const navyaOtherTeams = await TeamComposition.find({
        $or: [
          { 'teamLeader.userId': navyaUser._id },
          { 'teamMembers.userId': navyaUser._id }
        ],
        eventName: 'DANCE BATTLE',
        _id: { $ne: team._id }
      });

      if (navyaOtherTeams.length === 0) {
        // Remove DANCE BATTLE from Navya's events
        navyaUser.events = navyaUser.events.filter(event => event !== 'DANCE BATTLE');
        await navyaUser.save();
        console.log('Removed DANCE BATTLE from Navya\'s events as she\'s no longer in any DANCE BATTLE team');
      } else {
        console.log('Navya is still in other DANCE BATTLE teams, keeping event in her profile');
      }
    }

    console.log('\n=== DANCE BATTLE TEAM UPDATE COMPLETED ===');
    console.log('✓ Team name updated to: Quintessence Dance crew (QDC)');
    console.log('✓ Team leader updated to: Aryan Jain (jeyaryan010@gmail.com)');
    console.log('✓ User records updated appropriately');

  } catch (error) {
    console.error('Error updating team:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateDanceBattleTeam();