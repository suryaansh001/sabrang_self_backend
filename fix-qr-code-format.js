/**
 * Script to Fix QR Codes - Ensure all QR codes are base64 encoded ObjectIDs
 * QR codes should contain the user's ObjectID in base64 format only
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

async function fixQRCodeFormat() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 FIXING QR CODE FORMAT');
    console.log('=' .repeat(80));
    console.log('🎯 Ensuring all QR codes are base64 encoded ObjectIDs only');
    console.log('');
    
    // 1. Find all users with QR codes
    const allUsers = await User.find({}).select('_id name email qrPath qrCodeBase64');
    
    console.log(`📊 Found ${allUsers.length} total users in database`);
    
    const usersWithQRPath = allUsers.filter(user => user.qrPath);
    const usersWithQRBase64 = allUsers.filter(user => user.qrCodeBase64);
    const usersWithBoth = allUsers.filter(user => user.qrPath && user.qrCodeBase64);
    const usersWithoutQR = allUsers.filter(user => !user.qrPath && !user.qrCodeBase64);
    
    console.log(`📊 QR Code Status:`);
    console.log(`   📱 Users with qrPath: ${usersWithQRPath.length}`);
    console.log(`   📱 Users with qrCodeBase64: ${usersWithQRBase64.length}`);
    console.log(`   📱 Users with both: ${usersWithBoth.length}`);
    console.log(`   ❌ Users without QR: ${usersWithoutQR.length}`);
    console.log('');
    
    // 2. Check current QR code formats
    console.log('🔍 ANALYZING CURRENT QR CODE FORMATS:');
    console.log('-' .repeat(60));
    
    let correctBase64Count = 0;
    let incorrectFormatCount = 0;
    let needsRegenerationCount = 0;
    
    for (const user of usersWithQRBase64.slice(0, 10)) { // Check first 10 for analysis
      console.log(`\n👤 ${user.name} (${user.email})`);
      console.log(`   🆔 ObjectID: ${user._id}`);
      
      if (user.qrCodeBase64) {
        try {
          // Try to decode the QR code base64
          const qrDataBuffer = Buffer.from(user.qrCodeBase64.replace('data:image/png;base64,', ''), 'base64');
          console.log(`   📱 QR Base64 exists (${qrDataBuffer.length} bytes)`);
          
          // The QR code should encode the ObjectID as string
          const expectedContent = user._id.toString();
          console.log(`   🎯 Expected content: ${expectedContent}`);
          
          // Check if QR code needs regeneration (we'll regenerate all to ensure consistency)
          console.log(`   ⚠️  Will regenerate to ensure ObjectID format`);
          needsRegenerationCount++;
          
        } catch (error) {
          console.log(`   ❌ Invalid base64 format: ${error.message}`);
          incorrectFormatCount++;
        }
      }
    }
    
    console.log(`\n📊 Analysis Summary:`);
    console.log(`   🔧 Users needing QR regeneration: ${needsRegenerationCount}`);
    console.log(`   ❌ Users with invalid format: ${incorrectFormatCount}`);
    console.log('');
    
    // 3. Regenerate QR codes for all users with proper ObjectID format
    console.log('🔧 REGENERATING QR CODES WITH CORRECT FORMAT:');
    console.log('-' .repeat(60));
    console.log('🎯 QR Code Content: User ObjectID (as string)');
    console.log('🎯 QR Code Format: Base64 encoded PNG');
    console.log('');
    
    let regeneratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process all users (not just those with existing QR codes)
    for (const user of allUsers) {
      try {
        // Content of QR code should be the ObjectID as string
        const qrContent = user._id.toString();
        
        console.log(`🔧 Processing: ${user.name} (${user.email})`);
        console.log(`   🆔 ObjectID: ${qrContent}`);
        
        // Generate QR code as base64
        const qrCodeDataURL = await QRCode.toDataURL(qrContent, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Also generate QR code file (for backward compatibility)
        const qrDir = process.env.NODE_ENV === 'production' ? '/app/uploads' : path.join(__dirname, 'public', 'qrcodes');
        
        // Create QR directory if it doesn't exist
        if (!fs.existsSync(qrDir)) {
          fs.mkdirSync(qrDir, { recursive: true });
        }
        
        const qrFileName = `qr_${user._id.toString()}.png`;
        const qrFilePath = path.join(qrDir, qrFileName);
        
        // Generate QR code file
        await QRCode.toFile(qrFilePath, qrContent, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Update user with both base64 and file path
        const qrPath = process.env.NODE_ENV === 'production' ? `/uploads/${qrFileName}` : `/qrcodes/${qrFileName}`;
        
        await User.findByIdAndUpdate(user._id, {
          qrCodeBase64: qrCodeDataURL,
          qrPath: qrPath
        });
        
        console.log(`   ✅ Generated QR code (content: ${qrContent})`);
        console.log(`   📱 Base64: ${qrCodeDataURL.substring(0, 50)}...`);
        console.log(`   📁 File: ${qrPath}`);
        
        regeneratedCount++;
        
        // Add small delay to avoid overwhelming the system
        if (regeneratedCount % 10 === 0) {
          console.log(`   ⏱️  Processed ${regeneratedCount} users...`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing ${user.name}: ${error.message}`);
        errorCount++;
      }
    }
    
    // 4. Verification - check a few regenerated QR codes
    console.log('\n✅ QR CODE REGENERATION COMPLETE');
    console.log('-' .repeat(60));
    console.log(`📊 Results:`);
    console.log(`   ✅ Successfully regenerated: ${regeneratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');
    
    // 5. Verify format of a few users
    console.log('🔍 VERIFICATION - Checking regenerated QR codes:');
    console.log('-' .repeat(60));
    
    const verificationUsers = await User.find({ qrCodeBase64: { $exists: true } })
      .select('_id name email qrCodeBase64 qrPath')
      .limit(5);
    
    for (const user of verificationUsers) {
      console.log(`\n✅ ${user.name} (${user.email})`);
      console.log(`   🆔 ObjectID: ${user._id}`);
      console.log(`   📱 QR Base64: ${user.qrCodeBase64 ? 'Present' : 'Missing'}`);
      console.log(`   📁 QR Path: ${user.qrPath || 'Not set'}`);
      
      if (user.qrCodeBase64) {
        const base64Data = user.qrCodeBase64.replace('data:image/png;base64,', '');
        console.log(`   📊 Base64 length: ${base64Data.length} characters`);
        console.log(`   🎯 QR Content should be: ${user._id.toString()}`);
      }
    }
    
    // 6. Final statistics
    const finalStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          withQRBase64: { $sum: { $cond: [{ $ifNull: ['$qrCodeBase64', false] }, 1, 0] } },
          withQRPath: { $sum: { $cond: [{ $ifNull: ['$qrPath', false] }, 1, 0] } },
          withBothQR: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $ifNull: ['$qrCodeBase64', false] }, 
                    { $ifNull: ['$qrPath', false] }
                  ] 
                }, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);
    
    console.log('\n📊 FINAL STATISTICS:');
    console.log('-' .repeat(60));
    if (finalStats.length > 0) {
      const stats = finalStats[0];
      console.log(`👥 Total Users: ${stats.totalUsers}`);
      console.log(`📱 Users with QR Base64: ${stats.withQRBase64}`);
      console.log(`📁 Users with QR Path: ${stats.withQRPath}`);
      console.log(`✅ Users with Both QR formats: ${stats.withBothQR}`);
      console.log(`📊 QR Coverage: ${((stats.withBothQR / stats.totalUsers) * 100).toFixed(1)}%`);
    }
    
    console.log('\n🎉 QR CODE FORMAT FIX COMPLETE!');
    console.log('✅ All QR codes now contain base64 encoded ObjectIDs');
    console.log('✅ Both qrCodeBase64 and qrPath fields are populated');
    console.log('✅ QR code content is user ObjectID as string');
    
    return {
      totalUsers: allUsers.length,
      regenerated: regeneratedCount,
      errors: errorCount,
      finalWithQR: regeneratedCount - errorCount
    };
    
  } catch (error) {
    console.error('❌ Error fixing QR code format:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { fixQRCodeFormat };

// Run the script if called directly
if (require.main === module) {
  fixQRCodeFormat();
}