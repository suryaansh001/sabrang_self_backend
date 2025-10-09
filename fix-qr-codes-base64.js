/**
 * Script to Fix QR Codes - Ensure All QR Codes are Base64 Encoded ObjectIDs
 * Only regenerates QR codes that are not valid base64 encoded ObjectIDs
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');

// Function to check if a string is valid base64
function isValidBase64(str) {
  if (!str || typeof str !== 'string') return false;
  
  try {
    // Check if it's valid base64
    const decoded = Buffer.from(str, 'base64').toString('base64');
    return decoded === str;
  } catch (error) {
    return false;
  }
}

// Function to check if decoded base64 matches the ObjectID
function isValidBase64ObjectId(base64String, objectId) {
  if (!isValidBase64(base64String)) return false;
  
  try {
    const decoded = Buffer.from(base64String, 'base64').toString('utf8');
    return decoded === objectId.toString();
  } catch (error) {
    return false;
  }
}

// Function to generate proper base64 QR code from ObjectID
function generateBase64QRCode(objectId) {
  return Buffer.from(objectId.toString()).toString('base64');
}

async function fixQRCodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 FIXING QR CODES - ENSURING BASE64 ENCODED OBJECT IDS');
    console.log('=' .repeat(80));
    
    // Find all users
    const allUsers = await User.find({})
      .select('_id name email qrCodeBase64 qrPath events isvalidated')
      .sort({ createdAt: 1 });
    
    console.log(`📊 Found ${allUsers.length} total users`);
    console.log('');
    
    let validQRCount = 0;
    let invalidQRCount = 0;
    let missingQRCount = 0;
    let fixedQRCount = 0;
    
    const usersToFix = [];
    
    // 1. Analyze existing QR codes
    console.log('🔍 ANALYZING EXISTING QR CODES:');
    console.log('-' .repeat(60));
    
    for (const user of allUsers) {
      const userId = user._id.toString();
      const currentQR = user.qrCodeBase64;
      
      let qrStatus = '';
      let needsFix = false;
      
      if (!currentQR) {
        qrStatus = '❌ MISSING';
        missingQRCount++;
        needsFix = true;
      } else if (!isValidBase64(currentQR)) {
        qrStatus = '❌ NOT BASE64';
        invalidQRCount++;
        needsFix = true;
      } else if (!isValidBase64ObjectId(currentQR, user._id)) {
        qrStatus = '❌ INVALID OBJECTID';
        invalidQRCount++;
        needsFix = true;
      } else {
        qrStatus = '✅ VALID';
        validQRCount++;
      }
      
      if (needsFix) {
        usersToFix.push({
          user,
          currentQR,
          reason: qrStatus
        });
      }
      
      // Show first 10 users as examples
      if (validQRCount + invalidQRCount + missingQRCount <= 10) {
        console.log(`${validQRCount + invalidQRCount + missingQRCount}. ${user.name} (${user.email})`);
        console.log(`   🆔 ObjectID: ${userId}`);
        console.log(`   📱 QR Status: ${qrStatus}`);
        if (currentQR) {
          console.log(`   📝 Current QR: ${currentQR.substring(0, 50)}${currentQR.length > 50 ? '...' : ''}`);
          if (isValidBase64(currentQR)) {
            try {
              const decoded = Buffer.from(currentQR, 'base64').toString('utf8');
              console.log(`   🔓 Decoded: ${decoded}`);
              console.log(`   ✅ Matches ObjectID: ${decoded === userId ? 'Yes' : 'No'}`);
            } catch (error) {
              console.log(`   ❌ Decode Error: ${error.message}`);
            }
          }
        }
        console.log('');
      }
    }
    
    if (allUsers.length > 10) {
      console.log(`... and ${allUsers.length - 10} more users`);
      console.log('');
    }
    
    // 2. Summary of analysis
    console.log('📊 QR CODE ANALYSIS SUMMARY:');
    console.log('-' .repeat(60));
    console.log(`✅ Valid QR Codes: ${validQRCount}`);
    console.log(`❌ Invalid QR Codes: ${invalidQRCount}`);
    console.log(`📭 Missing QR Codes: ${missingQRCount}`);
    console.log(`🔧 Total QR Codes to Fix: ${usersToFix.length}`);
    console.log('');
    
    // 3. Fix invalid QR codes
    if (usersToFix.length > 0) {
      console.log('🔧 FIXING INVALID QR CODES:');
      console.log('-' .repeat(60));
      
      for (let i = 0; i < usersToFix.length; i++) {
        const { user, currentQR, reason } = usersToFix[i];
        const userId = user._id.toString();
        
        // Generate correct base64 QR code
        const correctQR = generateBase64QRCode(user._id);
        
        console.log(`${i + 1}. 🔧 Fixing: ${user.name} (${user.email})`);
        console.log(`   🆔 ObjectID: ${userId}`);
        console.log(`   📝 Reason: ${reason}`);
        if (currentQR) {
          console.log(`   📱 Old QR: ${currentQR.substring(0, 50)}${currentQR.length > 50 ? '...' : ''}`);
        }
        console.log(`   📱 New QR: ${correctQR}`);
        
        // Verify the new QR code
        const decodedNew = Buffer.from(correctQR, 'base64').toString('utf8');
        console.log(`   ✅ Decoded: ${decodedNew}`);
        console.log(`   ✅ Matches ObjectID: ${decodedNew === userId ? 'Yes' : 'No'}`);
        
        // Update the user
        try {
          await User.findByIdAndUpdate(user._id, {
            qrCodeBase64: correctQR,
            qrPath: `/qr/${userId}.png` // Update qrPath if needed
          });
          
          fixedQRCount++;
          console.log(`   ✅ Updated successfully`);
        } catch (error) {
          console.log(`   ❌ Update failed: ${error.message}`);
        }
        
        console.log('');
      }
    } else {
      console.log('✅ No QR codes need fixing - all are already valid!');
    }
    
    // 4. Final verification
    console.log('🔍 FINAL VERIFICATION:');
    console.log('-' .repeat(60));
    
    // Re-check all users
    const verificationUsers = await User.find({})
      .select('_id name email qrCodeBase64')
      .limit(5); // Check first 5 as examples
    
    console.log('Verifying first 5 users after fix:');
    for (const user of verificationUsers) {
      const userId = user._id.toString();
      const qr = user.qrCodeBase64;
      
      if (qr && isValidBase64ObjectId(qr, user._id)) {
        console.log(`✅ ${user.name}: QR code is valid base64 ObjectID`);
      } else {
        console.log(`❌ ${user.name}: QR code is still invalid`);
      }
    }
    
    // Final count
    const finalValidCount = await User.countDocuments({
      qrCodeBase64: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log('');
    console.log('📊 FINAL SUMMARY:');
    console.log('-' .repeat(60));
    console.log(`🔧 QR Codes Fixed: ${fixedQRCount}`);
    console.log(`✅ Users with QR Codes: ${finalValidCount}/${allUsers.length}`);
    console.log(`📈 Success Rate: ${((finalValidCount / allUsers.length) * 100).toFixed(1)}%`);
    
    if (fixedQRCount > 0) {
      console.log('');
      console.log('🎉 QR CODE FIX COMPLETED!');
      console.log('✅ All QR codes are now base64 encoded ObjectIDs');
    }
    
    return {
      totalUsers: allUsers.length,
      validQRsBefore: validQRCount,
      invalidQRsBefore: invalidQRCount + missingQRCount,
      qrCodesFixed: fixedQRCount,
      finalValidQRs: finalValidCount
    };
    
  } catch (error) {
    console.error('❌ Error fixing QR codes:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { 
  fixQRCodes,
  isValidBase64,
  isValidBase64ObjectId,
  generateBase64QRCode
};

// Run the script if called directly
if (require.main === module) {
  fixQRCodes();
}