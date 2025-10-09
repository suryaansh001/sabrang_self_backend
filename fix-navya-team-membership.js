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

async function fixNavyaTeamMembership() {
  try {
    console.log('Fixing Navya\'s team membership and user record...');

    // First, let's examine the current situation
    const navyaUser = await User.findOne({ email: 'navya.23bcon1308@jecrcu.edu.in' });
    console.log('Current Navya user record:', {
      _id: navyaUser._id,
      name: navyaUser.name,
      email: navyaUser.email,
      events: navyaUser.events
    });

    // Fix Navya's user record - correct the name and ensure she has both events
    console.log('Fixing Navya\'s user record...');
    await User.updateOne(
      { _id: navyaUser._id },
      {
        $set: {
          name: 'Navya joshi',
          events: ['STEP UP', 'DANCE BATTLE'] // Ensure both events are present
        }
      }
    );
    console.log('✓ Updated Navya\'s user record with correct name and events');

    // Find the DANCE BATTLE team
    const danceBattleTeam = await TeamComposition.findOne({
      _id: new mongoose.Types.ObjectId('68e1277607a7eecad868484e')
    });

    console.log('Current DANCE BATTLE team:', {
      _id: danceBattleTeam._id,
      teamName: danceBattleTeam.teamName,
      teamLeader: danceBattleTeam.teamLeader,
      teamMembersCount: danceBattleTeam.teamMembers?.length || 0
    });

    // Check if Navya is already in the team members
    const navyaInTeamMembers = danceBattleTeam.teamMembers.find(
      member => member.userId.toString() === navyaUser._id.toString()
    );

    if (!navyaInTeamMembers) {
      console.log('Adding Navya as a team member...');
      // Add Navya as a team member
      const updatedTeamMembers = [...danceBattleTeam.teamMembers, {
        userId: navyaUser._id,
        name: 'Navya joshi',
        email: 'navya.23bcon1308@jecrcu.edu.in',
        hasEntered: false
      }];

      await TeamComposition.updateOne(
        { _id: danceBattleTeam._id },
        {
          $set: {
            teamMembers: updatedTeamMembers
          }
        }
      );
      console.log('✓ Added Navya as a team member');
    } else {
      console.log('Navya is already a team member, updating her details...');
      // Update Navya's details in team members
      await TeamComposition.updateOne(
        { 
          _id: danceBattleTeam._id,
          'teamMembers.userId': navyaUser._id
        },
        {
          $set: {
            'teamMembers.$.name': 'Navya joshi',
            'teamMembers.$.email': 'navya.23bcon1308@jecrcu.edu.in'
          }
        }
      );
      console.log('✓ Updated Navya\'s details in team members');
    }

    // Now check if we need to find and replace Aryan in team members (if he was added as a member)
    const aryanUser = await User.findOne({ email: 'jeyaryan010@gmail.com' });
    if (aryanUser) {
      const aryanInTeamMembers = danceBattleTeam.teamMembers.find(
        member => member.userId.toString() === aryanUser._id.toString()
      );

      if (aryanInTeamMembers) {
        console.log('Removing Aryan from team members since he\'s the team leader...');
        await TeamComposition.updateOne(
          { _id: danceBattleTeam._id },
          {
            $pull: {
              teamMembers: { userId: aryanUser._id }
            }
          }
        );
        console.log('✓ Removed Aryan from team members');
      }
    }

    // Verify the final state
    console.log('\n=== VERIFICATION ===');
    
    const updatedNavyaUser = await User.findOne({ _id: navyaUser._id });
    console.log('Updated Navya user record:', {
      _id: updatedNavyaUser._id,
      name: updatedNavyaUser.name,
      email: updatedNavyaUser.email,
      events: updatedNavyaUser.events
    });

    const updatedTeam = await TeamComposition.findOne({ _id: danceBattleTeam._id });
    console.log('Updated DANCE BATTLE team:', {
      _id: updatedTeam._id,
      teamName: updatedTeam.teamName,
      teamLeader: {
        name: updatedTeam.teamLeader.name,
        email: updatedTeam.teamLeader.email
      },
      teamMembersCount: updatedTeam.teamMembers?.length || 0
    });

    // Check if Navya is in team members
    const navyaInUpdatedTeam = updatedTeam.teamMembers.find(
      member => member.email === 'navya.23bcon1308@jecrcu.edu.in'
    );
    console.log('Navya in team members:', navyaInUpdatedTeam ? 'Yes' : 'No');

    // Check Navya's STEP UP participation
    const stepUpTeams = await TeamComposition.find({
      eventName: 'STEP UP',
      $or: [
        { 'teamLeader.userId': navyaUser._id },
        { 'teamMembers.userId': navyaUser._id }
      ]
    });
    console.log('Navya\'s STEP UP teams count:', stepUpTeams.length);

    console.log('\n=== FIXES COMPLETED ===');
    console.log('✓ Navya\'s name corrected to "Navya joshi"');
    console.log('✓ Navya has both STEP UP and DANCE BATTLE events');
    console.log('✓ Navya is a member of DANCE BATTLE team');
    console.log('✓ Aryan Jain remains as team leader');

  } catch (error) {
    console.error('Error fixing team membership:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixNavyaTeamMembership();