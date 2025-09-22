const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function connectDB() {
  try {
    const mongoUri = process.env.mongodb || 'mongodb://localhost:27017/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function findUserRegistration() {
  try {
    console.log('🔍 Searching for real user registrations...\n');
    
    // Check for recent users (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    console.log('👤 RECENT USERS (last 24 hours):');
    const recentUsers = await User.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 }).limit(20);
    
    if (recentUsers.length > 0) {
      recentUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   QR Code: ${user.qrCodeBase64 ? 'Generated' : 'Not generated'}`);
        console.log(`   Team Size: ${user.teamSize || 'Not set'}`);
        console.log();
      });
    } else {
      console.log('No recent users found');
    }
    
    // Check for BGMI specifically
    console.log('\n🎮 BGMI REGISTRATIONS:');
    const bgmiUsers = await User.find({
      events: { $in: ['BGMI'] }
    }).sort({ createdAt: -1 });
    
    if (bgmiUsers.length > 0) {
      bgmiUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   QR Code: ${user.qrCodeBase64 ? 'Generated' : 'Not generated'}`);
        console.log();
      });
    } else {
      console.log('No BGMI registrations found');
    }
    
    // Check for DANCE BATTLE and BANDJAM
    console.log('\n💃 DANCE BATTLE REGISTRATIONS:');
    const danceUsers = await User.find({
      events: { $in: ['DANCE BATTLE'] }
    }).sort({ createdAt: -1 });
    
    if (danceUsers.length > 0) {
      danceUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Created: ${user.createdAt}`);
        console.log();
      });
    } else {
      console.log('No DANCE BATTLE registrations found');
    }
    
    console.log('\n🎵 BANDJAM REGISTRATIONS:');
    const bandjamUsers = await User.find({
      events: { $in: ['BANDJAM'] }
    }).sort({ createdAt: -1 });
    
    if (bandjamUsers.length > 0) {
      bandjamUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Events: [${user.events.join(', ')}]`);
        console.log(`   Created: ${user.createdAt}`);
        console.log();
      });
    } else {
      console.log('No BANDJAM registrations found');
    }
    
    // Check team compositions
    console.log('\n🏆 RECENT TEAM COMPOSITIONS:');
    const recentTeams = await TeamComposition.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 });
    
    if (recentTeams.length > 0) {
      recentTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.teamName} - ${team.eventName}`);
        console.log(`   Team ID: ${team.teamId}`);
        console.log(`   Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        console.log(`   Members: ${team.teamMembers.length}`);
        console.log(`   Payment Status: ${team.paymentStatus}`);
        console.log(`   Created: ${team.createdAt}`);
        console.log();
      });
    } else {
      console.log('No recent team compositions found');
    }
    
    // Check recent purchases
    console.log('\n💳 RECENT PURCHASES:');
    const recentPurchases = await Purchase.find({
      purchaseDate: { $gte: yesterday }
    }).sort({ purchaseDate: -1 });
    
    if (recentPurchases.length > 0) {
      recentPurchases.forEach((purchase, index) => {
        console.log(`${index + 1}. Order: ${purchase.orderId}`);
        console.log(`   User: ${purchase.userDetails.name} (${purchase.userDetails.email})`);
        console.log(`   Amount: ${purchase.totalAmount}`);
        console.log(`   Status: ${purchase.paymentStatus}`);
        console.log(`   Items: ${purchase.items.length}`);
        purchase.items.forEach(item => {
          console.log(`     - ${item.itemName} (${item.type})`);
        });
        console.log(`   Date: ${purchase.purchaseDate}`);
        console.log();
      });
    } else {
      console.log('No recent purchases found');
    }
    
    // Search by any email containing common patterns
    console.log('\n📧 USERS WITH COMMON EMAIL PATTERNS:');
    const emailPatterns = ['sury', 'gmail', 'jklu', 'test'];
    
    for (const pattern of emailPatterns) {
      const users = await User.find({
        email: { $regex: pattern, $options: 'i' },
        createdAt: { $gte: yesterday }
      }).sort({ createdAt: -1 }).limit(5);
      
      if (users.length > 0) {
        console.log(`\n📧 Users with "${pattern}" in email:`);
        users.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.name} (${user.email})`);
          console.log(`     Events: [${user.events.join(', ')}]`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching for registrations:', error);
  }
}

async function main() {
  await connectDB();
  await findUserRegistration();
  await mongoose.disconnect();
  console.log('\n👋 Search completed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
