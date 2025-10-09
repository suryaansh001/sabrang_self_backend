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

async function checkNavyaStepUpParticipation() {
  try {
    console.log('Checking Navya\'s STEP UP participation...');

    const navyaUser = await User.findOne({ email: 'navya.23bcon1308@jecrcu.edu.in' });
    console.log('Navya user ID:', navyaUser._id);

    // Check all STEP UP teams
    const allStepUpTeams = await TeamComposition.find({ eventName: 'STEP UP' });
    console.log('Total STEP UP teams:', allStepUpTeams.length);

    // Check if Navya is in any STEP UP teams by userId
    const navyaStepUpTeams = await TeamComposition.find({
      eventName: 'STEP UP',
      $or: [
        { 'teamLeader.userId': navyaUser._id },
        { 'teamMembers.userId': navyaUser._id }
      ]
    });
    console.log('Navya in STEP UP teams (by userId):', navyaStepUpTeams.length);

    // Check if Navya is in any STEP UP teams by email
    const navyaStepUpTeamsByEmail = await TeamComposition.find({
      eventName: 'STEP UP',
      $or: [
        { 'teamLeader.email': 'navya.23bcon1308@jecrcu.edu.in' },
        { 'teamMembers.email': 'navya.23bcon1308@jecrcu.edu.in' }
      ]
    });
    console.log('Navya in STEP UP teams (by email):', navyaStepUpTeamsByEmail.length);

    if (navyaStepUpTeamsByEmail.length > 0) {
      console.log('\nFound STEP UP teams with Navya\'s email:');
      navyaStepUpTeamsByEmail.forEach((team, index) => {
        console.log(`Team ${index + 1}:`, {
          _id: team._id,
          teamName: team.teamName,
          teamLeader: team.teamLeader,
          teamMembersCount: team.teamMembers?.length || 0
        });

        // Check if Navya is team leader
        if (team.teamLeader.email === 'navya.23bcon1308@jecrcu.edu.in') {
          console.log('  → Navya is TEAM LEADER');
          console.log('  → Leader userId:', team.teamLeader.userId);
          console.log('  → Navya userId:', navyaUser._id);
          console.log('  → UserIDs match:', team.teamLeader.userId.toString() === navyaUser._id.toString());
        }

        // Check if Navya is in team members
        const navyaAsMember = team.teamMembers.find(member => 
          member.email === 'navya.23bcon1308@jecrcu.edu.in'
        );
        if (navyaAsMember) {
          console.log('  → Navya is TEAM MEMBER');
          console.log('  → Member userId:', navyaAsMember.userId);
          console.log('  → Navya userId:', navyaUser._id);
          console.log('  → UserIDs match:', navyaAsMember.userId.toString() === navyaUser._id.toString());
        }
      });
    }

    // Check if there are any STEP UP teams that need userId fix
    console.log('\nChecking for STEP UP teams that might need userId fixes...');
    const teamsNeedingFix = [];
    
    for (const team of allStepUpTeams) {
      let needsFix = false;
      
      // Check team leader
      if (team.teamLeader.email === 'navya.23bcon1308@jecrcu.edu.in' && 
          team.teamLeader.userId.toString() !== navyaUser._id.toString()) {
        needsFix = true;
        console.log(`Team ${team.teamName} - Leader userId needs fix`);
      }
      
      // Check team members
      for (const member of team.teamMembers || []) {
        if (member.email === 'navya.23bcon1308@jecrcu.edu.in' && 
            member.userId.toString() !== navyaUser._id.toString()) {
          needsFix = true;
          console.log(`Team ${team.teamName} - Member userId needs fix`);
        }
      }
      
      if (needsFix) {
        teamsNeedingFix.push(team);
      }
    }

    if (teamsNeedingFix.length > 0) {
      console.log(`\nFound ${teamsNeedingFix.length} STEP UP teams that need userId fixes`);
      
      for (const team of teamsNeedingFix) {
        console.log(`Fixing team: ${team.teamName}`);
        
        // Fix team leader if needed
        if (team.teamLeader.email === 'navya.23bcon1308@jecrcu.edu.in') {
          await TeamComposition.updateOne(
            { _id: team._id },
            {
              $set: {
                'teamLeader.userId': navyaUser._id,
                'teamLeader.name': 'Navya joshi'
              }
            }
          );
          console.log('  ✓ Fixed team leader userId');
        }
        
        // Fix team members if needed
        for (let i = 0; i < (team.teamMembers || []).length; i++) {
          const member = team.teamMembers[i];
          if (member.email === 'navya.23bcon1308@jecrcu.edu.in') {
            await TeamComposition.updateOne(
              { 
                _id: team._id,
                'teamMembers.email': 'navya.23bcon1308@jecrcu.edu.in'
              },
              {
                $set: {
                  'teamMembers.$.userId': navyaUser._id,
                  'teamMembers.$.name': 'Navya joshi'
                }
              }
            );
            console.log('  ✓ Fixed team member userId');
            break;
          }
        }
      }
    }

    // Final verification
    console.log('\n=== FINAL VERIFICATION ===');
    const finalStepUpTeams = await TeamComposition.find({
      eventName: 'STEP UP',
      $or: [
        { 'teamLeader.userId': navyaUser._id },
        { 'teamMembers.userId': navyaUser._id }
      ]
    });
    console.log('Navya\'s STEP UP teams after fixes:', finalStepUpTeams.length);

    finalStepUpTeams.forEach((team, index) => {
      console.log(`STEP UP Team ${index + 1}:`, {
        teamName: team.teamName,
        isLeader: team.teamLeader.userId.toString() === navyaUser._id.toString(),
        isMember: team.teamMembers.some(m => m.userId.toString() === navyaUser._id.toString())
      });
    });

  } catch (error) {
    console.error('Error checking STEP UP participation:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkNavyaStepUpParticipation();