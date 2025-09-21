const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function checkRecentRegistrations() {
  try {
    const mongoUri = process.env.mongodb || 'mongodb://localhost:27017/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Check recent users (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`\n🔍 Checking registrations since: ${yesterday.toLocaleString()}`);
    
    const recentUsers = await User.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 });
    
    console.log(`\n👥 RECENT USERS (${recentUsers.length}):`);
    recentUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   Events: [${user.events.join(', ')}]`);
      console.log(`   Is Main Person: ${user.isMainPerson ? 'Yes' : 'No'}`);
      console.log(`   Team Size: ${user.teamSize || 'N/A'}`);
      console.log(`   QR Code: ${user.qrCodeBase64 ? 'Generated' : 'Not generated'}`);
      console.log(`   Validated: ${user.isvalidated ? 'Yes' : 'No'}`);
      console.log();
    });
    
    // Check recent team compositions
    const recentTeams = await TeamComposition.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 });
    
    console.log(`🏆 RECENT TEAM COMPOSITIONS (${recentTeams.length}):`);
    recentTeams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.teamName} - ${team.eventName}`);
      console.log(`   Created: ${team.createdAt.toLocaleString()}`);
      console.log(`   Team ID: ${team.teamId || 'Not set'}`);
      console.log(`   Payment Status: ${team.paymentStatus}`);
      console.log(`   Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
      console.log(`   Members: ${team.teamMembers.length}`);
      console.log();
    });
    
    // Check recent purchases
    const recentPurchases = await Purchase.find({
      purchaseDate: { $gte: yesterday }
    }).sort({ purchaseDate: -1 });
    
    console.log(`💳 RECENT PURCHASES (${recentPurchases.length}):`);
    recentPurchases.forEach((purchase, index) => {
      console.log(`${index + 1}. Order: ${purchase.orderId}`);
      console.log(`   Date: ${purchase.purchaseDate.toLocaleString()}`);
      console.log(`   User: ${purchase.userDetails.name} (${purchase.userDetails.email})`);
      console.log(`   Amount: ${purchase.totalAmount || purchase.subtotal}`);
      console.log(`   Status: ${purchase.paymentStatus}`);
      console.log(`   Items: ${purchase.items.length}`);
      console.log();
    });
    
    // Check all users with BGMI
    const bgmiUsers = await User.find({
      events: { $in: ['BGMI'] }
    }).sort({ createdAt: -1 });
    
    console.log(`🎮 ALL BGMI PLAYERS (${bgmiUsers.length}):`);
    bgmiUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   Events: [${user.events.join(', ')}]`);
      console.log();
    });
    
    // Check any potential issues
    const usersWithoutEvents = await User.find({
      $or: [
        { events: { $exists: false } },
        { events: { $size: 0 } }
      ],
      createdAt: { $gte: yesterday }
    });
    
    if (usersWithoutEvents.length > 0) {
      console.log(`⚠️ USERS WITHOUT EVENTS (${usersWithoutEvents.length}):`);
      usersWithoutEvents.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRecentRegistrations();
