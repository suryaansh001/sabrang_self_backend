/**
 * Fix BAND JAM Event Name Inconsistency
 * Standardizes all BAND JAM related event names to "BAND JAM"
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Event } = require('./models/models');

async function fixBandJamEventNames() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 FIXING BAND JAM EVENT NAME INCONSISTENCY');
    console.log('=' .repeat(80));
    
    const standardEventName = "BAND JAM";
    const variantsToFix = ["BANDJAM", "BandJam", "Band Jam", "bandjam", "band jam"];
    
    let totalUpdates = 0;
    
    // 1. Fix Team Compositions
    console.log('\n📊 STEP 1: UPDATING TEAM COMPOSITIONS');
    console.log('-' .repeat(60));
    
    for (const variant of variantsToFix) {
      const result = await TeamComposition.updateMany(
        { eventName: variant },
        { $set: { eventName: standardEventName } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Updated ${result.modifiedCount} teams from "${variant}" to "${standardEventName}"`);
        totalUpdates += result.modifiedCount;
      }
    }
    
    // 2. Fix Individual User Events
    console.log('\n📊 STEP 2: UPDATING USER EVENTS');
    console.log('-' .repeat(60));
    
    for (const variant of variantsToFix) {
      // Find users with the variant in their events array
      const usersWithVariant = await User.find({ events: variant });
      
      for (const user of usersWithVariant) {
        // Replace the variant with standard name
        const updatedEvents = user.events.map(event => 
          event === variant ? standardEventName : event
        );
        
        await User.findByIdAndUpdate(user._id, { events: updatedEvents });
        console.log(`✅ Updated user ${user.name} (${user.email}): "${variant}" → "${standardEventName}"`);
        totalUpdates++;
      }
    }
    
    // 3. Fix Event Collection
    console.log('\n📊 STEP 3: UPDATING EVENT COLLECTION');
    console.log('-' .repeat(60));
    
    for (const variant of variantsToFix) {
      const result = await Event.updateMany(
        { name: variant },
        { $set: { name: standardEventName } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Updated ${result.modifiedCount} events from "${variant}" to "${standardEventName}"`);
        totalUpdates += result.modifiedCount;
      }
    }
    
    // 4. Verification
    console.log('\n📊 STEP 4: VERIFICATION');
    console.log('-' .repeat(60));
    
    const finalTeamCount = await TeamComposition.countDocuments({ eventName: standardEventName });
    const finalUserCount = await User.countDocuments({ events: standardEventName });
    const finalEventCount = await Event.countDocuments({ name: standardEventName });
    
    console.log(`✅ Final verification:`);
    console.log(`   Teams with "${standardEventName}": ${finalTeamCount}`);
    console.log(`   Users with "${standardEventName}": ${finalUserCount}`);
    console.log(`   Events named "${standardEventName}": ${finalEventCount}`);
    
    // 5. Check for remaining variants
    console.log('\n📊 STEP 5: CHECKING FOR REMAINING VARIANTS');
    console.log('-' .repeat(60));
    
    const remainingTeamVariants = await TeamComposition.distinct('eventName', {
      eventName: { $regex: /band.*jam|jam.*band/i, $ne: standardEventName }
    });
    
    const remainingUserVariants = await User.distinct('events', {
      events: { $regex: /band.*jam|jam.*band/i, $ne: standardEventName }
    });
    
    if (remainingTeamVariants.length > 0 || remainingUserVariants.length > 0) {
      console.log('⚠️  Remaining variants found:');
      if (remainingTeamVariants.length > 0) {
        console.log(`   Team variants: ${remainingTeamVariants.join(', ')}`);
      }
      if (remainingUserVariants.length > 0) {
        console.log(`   User variants: ${remainingUserVariants.join(', ')}`);
      }
    } else {
      console.log('✅ No remaining variants found!');
    }
    
    console.log('\n🎉 BAND JAM EVENT NAME STANDARDIZATION COMPLETED!');
    console.log(`📊 Total updates made: ${totalUpdates}`);
    
    return {
      success: true,
      totalUpdates,
      finalCounts: {
        teams: finalTeamCount,
        users: finalUserCount,
        events: finalEventCount
      },
      remainingVariants: {
        teams: remainingTeamVariants,
        users: remainingUserVariants
      }
    };
    
  } catch (error) {
    console.error('❌ Error fixing BAND JAM event names:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { fixBandJamEventNames };

// Run the script if called directly
if (require.main === module) {
  fixBandJamEventNames();
}