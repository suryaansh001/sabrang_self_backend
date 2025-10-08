/**
 * Script to remove STEP UP team compositions from the database
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

async function removeStepUpTeams() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    // First, find all STEP UP team compositions to see what we're removing
    console.log('🔍 Finding STEP UP team compositions...');
    const stepUpTeams = await TeamComposition.find({ 
      eventName: 'STEP UP' 
    })
    .populate('teamLeader.userId', 'name email events')
    .populate('teamMembers.userId', 'name email events');
    
    if (stepUpTeams.length === 0) {
      console.log('📭 No STEP UP teams found in database');
      return;
    }
    
    console.log(`\n🔍 Found ${stepUpTeams.length} STEP UP team compositions to remove:\n`);
    
    // Display what will be removed
    stepUpTeams.forEach((team, index) => {
      console.log(`${index + 1}. Team: "${team.teamName}"`);
      console.log(`   ID: ${team._id}`);
      console.log(`   Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
      console.log(`   Members: ${team.teamMembers.length}`);
      console.log(`   Total Size: ${team.totalMembers}`);
      console.log('');
    });
    
    // Ask for confirmation (in a real scenario, you might want to add user input)
    console.log('⚠️  WARNING: This will permanently remove these team compositions!');
    console.log('💡 Note: This will NOT remove the users themselves, only the team compositions.');
    
    // Proceed with removal
    console.log('\n🗑️  Removing STEP UP team compositions...');
    
    const deleteResult = await TeamComposition.deleteMany({ 
      eventName: 'STEP UP' 
    });
    
    console.log(`✅ Successfully removed ${deleteResult.deletedCount} STEP UP team compositions`);
    
    // Verify removal
    const remainingStepUpTeams = await TeamComposition.countDocuments({ 
      eventName: 'STEP UP' 
    });
    
    if (remainingStepUpTeams === 0) {
      console.log('✅ Verification: No STEP UP team compositions remain in database');
    } else {
      console.log(`⚠️  Warning: ${remainingStepUpTeams} STEP UP team compositions still exist`);
    }
    
    // Optional: Clean up users who only had STEP UP event
    console.log('\n🧹 Checking users who only had STEP UP event...');
    const stepUpOnlyUsers = await User.find({ 
      events: ['STEP UP'] 
    }).select('name email events');
    
    if (stepUpOnlyUsers.length > 0) {
      console.log(`Found ${stepUpOnlyUsers.length} users who only had STEP UP:`);
      stepUpOnlyUsers.forEach(user => {
        console.log(`  - ${user.name} (${user.email})`);
      });
      console.log('💡 You may want to review these users separately.');
    }
    
    // Remove STEP UP from users' events arrays
    console.log('\n🧹 Removing STEP UP from all users\' events arrays...');
    const updateResult = await User.updateMany(
      { events: 'STEP UP' },
      { $pull: { events: 'STEP UP' } }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} users to remove STEP UP from their events`);
    
  } catch (error) {
    console.error('❌ Error removing STEP UP teams:', error);
  } finally {
    process.exit(0); // Force exit to avoid the disconnect issue
  }
}

// Load environment variables
require('dotenv').config();

// Run the script
removeStepUpTeams();