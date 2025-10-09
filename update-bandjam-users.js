/**
 * Update BAND JAM users with proper event assignment
 * These users were identified as needing BAND JAM event assignment
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');

async function updateBandJamUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🎵 UPDATING BAND JAM USERS');
    console.log('=' .repeat(60));
    
    // List of users that need BAND JAM event assignment
    const bandJamUsers = [
      'utkarsh.229301134@muj.manipal.edu',
      'devansh.srivastava1818@gmail.com',
      'fecebol854@artvara.com',
      'logozezy@fxzig.com',
      'amanpratapsinghuy@gmail.com',
      'raghasharma2025@jklu.edu.in',
      'dishikasharma@jklu.edu.in',
      'arnavsharma@jklu.edu.in',
      'pratigyabomb@jklu.edu.in',
      'pathakmayank522@gmail.com',
      'jainjheel1406@gmail.com',
      'asthabarnwal@jklu.edu.in'
    ];
    
    console.log(`📧 Processing ${bandJamUsers.length} BAND JAM users...`);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let alreadyHasEventCount = 0;
    
    for (let i = 0; i < bandJamUsers.length; i++) {
      const email = bandJamUsers[i].toLowerCase();
      console.log(`\n${i + 1}/${bandJamUsers.length}. Processing: ${email}`);
      
      try {
        // Find the user
        const user = await User.findOne({ email: email });
        
        if (!user) {
          console.log(`   ❌ User not found: ${email}`);
          notFoundCount++;
          continue;
        }
        
        console.log(`   👤 Found user: ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🎯 Current events: ${user.events ? user.events.join(', ') : 'None'}`);
        
        // Check if user already has BAND JAM or any events
        const currentEvents = user.events || [];
        const hasBandJam = currentEvents.some(event => 
          event.toLowerCase().includes('band') && event.toLowerCase().includes('jam')
        );
        
        if (hasBandJam) {
          console.log(`   ✅ Already has BAND JAM event`);
          alreadyHasEventCount++;
          continue;
        }
        
        // Add BAND JAM to events
        const updatedEvents = [...currentEvents, 'BAND JAM'];
        
        // Update the user
        await User.findByIdAndUpdate(user._id, {
          events: updatedEvents
        });
        
        console.log(`   ✅ Updated events: ${updatedEvents.join(', ')}`);
        updatedCount++;
        
      } catch (error) {
        console.log(`   ❌ Error updating ${email}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 UPDATE SUMMARY:');
    console.log('-' .repeat(40));
    console.log(`👥 Total users processed: ${bandJamUsers.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`🔄 Already had BAND JAM: ${alreadyHasEventCount}`);
    console.log(`❌ Users not found: ${notFoundCount}`);
    
    // Verify updates
    console.log('\n🔍 VERIFICATION:');
    console.log('-' .repeat(40));
    
    const updatedUsers = await User.find({
      email: { $in: bandJamUsers.map(e => e.toLowerCase()) },
      events: 'BAND JAM'
    }).select('name email events');
    
    console.log(`✅ Users now with BAND JAM: ${updatedUsers.length}`);
    
    updatedUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} (${user.email}) - Events: ${user.events.join(', ')}`);
    });
    
    // Show users still without BAND JAM
    const usersWithoutBandJam = await User.find({
      email: { $in: bandJamUsers.map(e => e.toLowerCase()) },
      $or: [
        { events: { $exists: false } },
        { events: { $size: 0 } },
        { events: { $not: { $in: ['BAND JAM'] } } }
      ]
    }).select('name email events');
    
    if (usersWithoutBandJam.length > 0) {
      console.log('\n⚠️  USERS STILL WITHOUT BAND JAM:');
      console.log('-' .repeat(40));
      usersWithoutBandJam.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (${user.email}) - Events: ${user.events ? user.events.join(', ') : 'None'}`);
      });
    } else {
      console.log('\n🎉 ALL USERS NOW HAVE BAND JAM EVENT!');
    }
    
    console.log('\n🎵 BAND JAM UPDATE COMPLETED!');
    
    return {
      totalProcessed: bandJamUsers.length,
      updated: updatedCount,
      alreadyHad: alreadyHasEventCount,
      notFound: notFoundCount,
      finalWithBandJam: updatedUsers.length
    };
    
  } catch (error) {
    console.error('❌ Error updating BAND JAM users:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { updateBandJamUsers };

// Run the script if called directly
if (require.main === module) {
  updateBandJamUsers();
}