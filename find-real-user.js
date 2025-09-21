const mongoose = require('mongoose');
require('dotenv').config();

const { User, TeamComposition, Purchase } = require('./models/models');

async function findRealUser() {
  try {
    await mongoose.connect(process.env.mongodb);
    console.log('Connected to MongoDB');

    // Find ALL recent users (not just test data)
    console.log('\n=== ALL RECENT USERS (Last 48 hours) ===');
    const recentUsers = await User.find({
      createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    console.log(`Found ${recentUsers.length} recent users:`);
    recentUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Events: [${user.events.join(', ')}] - Created: ${user.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });

    // Find all users with BGMI event
    console.log('\n=== ALL BGMI USERS ===');
    const bgmiUsers = await User.find({ 
      events: { $in: ['BGMI', 'bgmi', 'Bgmi'] }
    }).sort({ createdAt: -1 });

    console.log(`Found ${bgmiUsers.length} BGMI users:`);
    bgmiUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Events: [${user.events.join(', ')}] - Created: ${user.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} - QR: ${user.qrCodeBase64 ? 'YES' : 'NO'}`);
    });

    // Find all team compositions
    console.log('\n=== ALL TEAM COMPOSITIONS ===');
    const allTeams = await TeamComposition.find({}).sort({ createdAt: -1 });
    
    console.log(`Found ${allTeams.length} team compositions:`);
    allTeams.forEach(team => {
      console.log(`- Team: ${team.teamName} - Event: ${team.eventName} - Leader: ${team.teamLeader.name} (${team.teamLeader.email}) - Members: ${team.teamMembers.length} - Created: ${team.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });

    // Find users with DANCE BATTLE or BANDJAM
    console.log('\n=== DANCE BATTLE / BANDJAM USERS ===');
    const danceUsers = await User.find({ 
      events: { $in: ['DANCE BATTLE', 'BANDJAM', 'dance battle', 'bandjam', 'Dance Battle', 'BandJam'] }
    }).sort({ createdAt: -1 });

    console.log(`Found ${danceUsers.length} DANCE BATTLE/BANDJAM users:`);
    danceUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Events: [${user.events.join(', ')}] - Created: ${user.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });

    // Search for any non-test email patterns
    console.log('\n=== NON-TEST EMAILS ===');
    const realUsers = await User.find({
      email: { 
        $not: { 
          $in: ['john@example.com', 'jane@example.com', 'bob@example.com'] 
        }
      }
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`Found ${realUsers.length} real users:`);
    realUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Events: [${user.events.join(', ')}] - Created: ${user.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} - QR: ${user.qrCodeBase64 ? 'YES' : 'NO'}`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
  }
}

findRealUser();
