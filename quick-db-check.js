const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function quickCheck() {
  try {
    const mongoUri = process.env.mongodb || 'mongodb://localhost:27017/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Quick stats
    const userCount = await User.countDocuments();
    const teamCount = await TeamComposition.countDocuments();
    const purchaseCount = await Purchase.countDocuments();
    
    console.log('\n📊 DATABASE OVERVIEW:');
    console.log(`👥 Total Users: ${userCount}`);
    console.log(`🏅 Total Teams: ${teamCount}`);
    console.log(`💳 Total Purchases: ${purchaseCount}`);
    
    // Show recent teams if any
    if (teamCount > 0) {
      console.log('\n🏆 RECENT TEAMS:');
      const recentTeams = await TeamComposition.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('eventName teamName teamId createdAt totalMembers');
      
      recentTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.teamName} (${team.eventName}) - ${team.totalMembers} members`);
      });
    }
    
    // Show recent users with events
    console.log('\n👤 RECENT USERS WITH EVENTS:');
    const usersWithEvents = await User.find({ events: { $exists: true, $ne: [] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email events');
    
    if (usersWithEvents.length > 0) {
      usersWithEvents.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - Events: [${user.events.join(', ')}]`);
      });
    } else {
      console.log('No users with events found');
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickCheck();
