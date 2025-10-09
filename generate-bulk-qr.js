const { User } = require('./models/models');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateBulkQR() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');

    // Read the missing QR data
    const timestamp = new Date().toISOString().split('T')[0];
    let dataFile = `all_missing_qr_${timestamp}.json`;
    
    // If today's file doesn't exist, look for the latest one
    if (!fs.existsSync(dataFile)) {
      const files = fs.readdirSync('.').filter(f => f.startsWith('all_missing_qr_') && f.endsWith('.json'));
      if (files.length > 0) {
        dataFile = files.sort().reverse()[0]; // Get the latest file
        console.log(`📁 Using latest data file: ${dataFile}`);
      } else {
        console.log('❌ No missing QR data file found. Please run check-missing-qr.js first.');
        return;
      }
    }

    const missingQRData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    // Remove duplicates based on ID
    const uniqueUsers = missingQRData.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    console.log(`📊 Found ${missingQRData.length} entries (${uniqueUsers.length} unique users) needing QR generation\n`);

    // Create QR directory if it doesn't exist
    const qrDir = path.join(__dirname, 'qr_codes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (let i = 0; i < uniqueUsers.length; i++) {
      const userData = uniqueUsers[i];
      console.log(`🔄 Processing ${i + 1}/${uniqueUsers.length}: ${userData.name} (${userData.email})`);

      try {
        // Find the user in database
        const user = await User.findById(userData.id);
        if (!user) {
          console.log(`   ❌ User not found in database`);
          failCount++;
          results.push({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            status: 'failed',
            error: 'User not found in database'
          });
          continue;
        }

        // Generate QR code data
        const qrData = JSON.stringify({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          events: user.events || []
        });

        // Generate QR code as base64
        const qrCodeBase64 = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256
        });

        // Save QR code as file
        const fileName = `qr_${user._id}.png`;
        const filePath = path.join(qrDir, fileName);
        const qrRelativePath = `qr_codes/${fileName}`;

        // Convert base64 to buffer and save
        const base64Data = qrCodeBase64.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(filePath, base64Data, 'base64');

        // Update user in database
        user.qrPath = qrRelativePath;
        user.qrCodeBase64 = qrCodeBase64;
        await user.save();

        console.log(`   ✅ QR code generated and saved`);
        successCount++;
        results.push({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          status: 'success',
          qrPath: qrRelativePath
        });

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;
        results.push({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          status: 'failed',
          error: error.message
        });
      }

      // Add small delay to avoid overwhelming the system
      if (i < uniqueUsers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Save results
    const resultFile = `bulk_qr_generation_results_${timestamp}.json`;
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));

    // Summary
    console.log('\n📊 BULK QR GENERATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully generated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📁 Results saved to: ${resultFile}`);
    console.log(`📁 QR codes saved in: ${qrDir}`);

    if (failCount > 0) {
      console.log('\n❌ Failed entries:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`   - ${r.name} (${r.email}): ${r.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Error in bulk QR generation:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Command line arguments handling
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🎯 Bulk QR Code Generator

Usage: node generate-bulk-qr.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be generated without actually generating
  --file <path>  Use specific JSON file instead of latest

This script reads the output from check-missing-qr.js and generates QR codes
for all users who don't have them.

Make sure to run check-missing-qr.js first to generate the data file.
  `);
  process.exit(0);
}

// Run the bulk generation
generateBulkQR();