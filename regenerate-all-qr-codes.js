/**
 * Regenerate QR Codes for All Users
 * Uses the proper qrCodeService to generate actual QR code images
 * instead of simple base64 encoded ObjectIDs
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');

async function regenerateAllQRCodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 QR CODE REGENERATION FOR ALL USERS');
    console.log('=' .repeat(80));
    
    // Get all users
    console.log('\n📊 Fetching all users...');
    const allUsers = await User.find({}).select('_id name email qrCodeBase64');
    console.log(`📊 Found ${allUsers.length} users in database`);
    
    // Analyze current QR codes
    console.log('\n🔍 ANALYZING CURRENT QR CODES:');
    console.log('-' .repeat(60));
    
    let properQRCount = 0;
    let textQRCount = 0;
    let missingQRCount = 0;
    
    const usersNeedingUpdate = [];
    
    for (const user of allUsers) {
      if (!user.qrCodeBase64) {
        missingQRCount++;
        usersNeedingUpdate.push({ user, reason: 'Missing QR code' });
      } else {
        try {
          // Check if it's a proper PNG image
          const buffer = Buffer.from(user.qrCodeBase64, 'base64');
          const isPNG = buffer.length > 8 && 
                       buffer[0] === 0x89 && 
                       buffer[1] === 0x50 && 
                       buffer[2] === 0x4E && 
                       buffer[3] === 0x47;
          
          if (isPNG && buffer.length > 100) {
            properQRCount++;
          } else {
            // Check if it's just base64 encoded text
            try {
              const decoded = Buffer.from(user.qrCodeBase64, 'base64').toString('utf8');
              if (decoded === user._id.toString()) {
                textQRCount++;
                usersNeedingUpdate.push({ user, reason: 'Text-based QR (not image)' });
              } else {
                usersNeedingUpdate.push({ user, reason: 'Invalid QR format' });
              }
            } catch (e) {
              usersNeedingUpdate.push({ user, reason: 'Invalid QR format' });
            }
          }
        } catch (e) {
          usersNeedingUpdate.push({ user, reason: 'Corrupted QR data' });
        }
      }
    }
    
    console.log(`✅ Proper QR images: ${properQRCount}`);
    console.log(`⚠️  Text-based QRs: ${textQRCount}`);
    console.log(`❌ Missing QR codes: ${missingQRCount}`);
    console.log(`🔄 Users needing update: ${usersNeedingUpdate.length}`);
    
    if (usersNeedingUpdate.length === 0) {
      console.log('\n🎉 All users already have proper QR codes!');
      return;
    }
    
    console.log('\n🔄 REGENERATING QR CODES:');
    console.log('-' .repeat(60));
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < usersNeedingUpdate.length; i++) {
      const { user, reason } = usersNeedingUpdate[i];
      
      console.log(`\n${i + 1}/${usersNeedingUpdate.length}. ${user.name} (${user.email})`);
      console.log(`   Reason: ${reason}`);
      
      try {
        // Generate new QR code using the service
        const newQRCode = await generateUserQRCode(user._id.toString(), user);
        
        // Update the user
        await User.findByIdAndUpdate(user._id, { qrCodeBase64: newQRCode });
        
        successCount++;
        console.log(`   ✅ Generated new QR code (${newQRCode.length} chars)`);
        
        // Add small delay to avoid overwhelming the system
        if (i > 0 && i % 10 === 0) {
          console.log('   ⏳ Brief pause...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        errorCount++;
        errors.push({ user: user.email, error: error.message });
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n📊 REGENERATION SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`👥 Total users processed: ${usersNeedingUpdate.length}`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      console.log('-' .repeat(40));
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.user}: ${err.error}`);
      });
    }
    
    // Final verification
    console.log('\n🔍 FINAL VERIFICATION:');
    console.log('-' .repeat(60));
    
    const finalUsers = await User.find({}).select('_id name email qrCodeBase64');
    let finalProperCount = 0;
    let finalMissingCount = 0;
    
    for (const user of finalUsers) {
      if (!user.qrCodeBase64) {
        finalMissingCount++;
      } else {
        try {
          const buffer = Buffer.from(user.qrCodeBase64, 'base64');
          const isPNG = buffer.length > 8 && 
                       buffer[0] === 0x89 && 
                       buffer[1] === 0x50 && 
                       buffer[2] === 0x4E && 
                       buffer[3] === 0x47;
          
          if (isPNG && buffer.length > 100) {
            finalProperCount++;
          }
        } catch (e) {
          // Ignore verification errors
        }
      }
    }
    
    console.log(`✅ Users with proper QR images: ${finalProperCount}/${finalUsers.length}`);
    console.log(`❌ Users still missing QR codes: ${finalMissingCount}`);
    
    const successRate = Math.round((finalProperCount / finalUsers.length) * 100);
    console.log(`📊 Success rate: ${successRate}%`);
    
    if (finalProperCount === finalUsers.length) {
      console.log('\n🎉 ALL USERS NOW HAVE PROPER QR CODES!');
      console.log('📱 All QR codes are viewable PNG images that can be scanned.');
    } else {
      console.log('\n⚠️  Some users still need QR code generation.');
    }
    
    console.log('\n🔄 QR CODE REGENERATION COMPLETED!');
    
  } catch (error) {
    console.error('❌ Error in QR code regeneration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { regenerateAllQRCodes };

// Run the script if called directly
if (require.main === module) {
  regenerateAllQRCodes();
}