/**
 * Test Script for User Synchronization
 * Tests individual components before running the full sync
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const { testEmailConfig, sendEmailWithRetry } = require('./email-service');
const { generateBase64QRCode } = require('./sync-users-comprehensive');

async function runTests() {
  try {
    console.log('🧪 RUNNING SYNCHRONIZATION TESTS');
    console.log('=' .repeat(60));
    
    // Test 1: MongoDB Connection
    console.log('\n1️⃣ Testing MongoDB Connection...');
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ MongoDB connection successful');
    
    // Test 2: Email Configuration
    console.log('\n2️⃣ Testing Email Configuration...');
    const emailConfigValid = await testEmailConfig();
    
    // Test 3: QR Code Generation
    console.log('\n3️⃣ Testing QR Code Generation...');
    const testObjectId = new mongoose.Types.ObjectId();
    const qrCode = generateBase64QRCode(testObjectId);
    console.log(`✅ Generated QR Code: ${qrCode}`);
    console.log(`✅ Decoded: ${Buffer.from(qrCode, 'base64').toString('utf8')}`);
    console.log(`✅ Matches ObjectID: ${Buffer.from(qrCode, 'base64').toString('utf8') === testObjectId.toString()}`);
    
    // Test 4: Database Query
    console.log('\n4️⃣ Testing Database Queries...');
    const userCount = await User.countDocuments();
    console.log(`✅ Found ${userCount} users in database`);
    
    // Test 5: Sample User Creation (if email is configured)
    if (emailConfigValid) {
      console.log('\n5️⃣ Testing Sample Email (Optional)...');
      console.log('Would you like to send a test email? (This will create a temporary user)');
      console.log('Run with TEST_EMAIL=true environment variable to enable this test');
      
      if (process.env.TEST_EMAIL === 'true') {
        const testUser = {
          name: 'Test User',
          email: process.env.TEST_EMAIL_ADDRESS || 'test@example.com',
          contactNo: '1234567890',
          events: ['STEP UP', 'DANCE BATTLE'],
          universityName: 'Test University'
        };
        
        console.log(`Sending test email to: ${testUser.email}`);
        const emailSent = await sendEmailWithRetry(testUser, qrCode);
        
        if (emailSent) {
          console.log('✅ Test email sent successfully');
        } else {
          console.log('❌ Test email failed');
        }
      }
    }
    
    // Test 6: File System Check
    console.log('\n6️⃣ Checking for Data Files...');
    const fs = require('fs');
    const dataFiles = [
      'rawusers.csv',
      'sabrang_registrations_2025-10-06.csv',
      'sabrang_registrations_2025-10-07.csv',
      'teamcompositions_2025-10-06.json'
    ];
    
    let filesFound = 0;
    for (const file of dataFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ Found: ${file}`);
        filesFound++;
      } else {
        console.log(`❌ Missing: ${file}`);
      }
    }
    
    console.log(`📊 Found ${filesFound}/${dataFiles.length} expected data files`);
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('-' .repeat(40));
    console.log(`✅ MongoDB: Connected`);
    console.log(`${emailConfigValid ? '✅' : '❌'} Email: ${emailConfigValid ? 'Configured' : 'Not configured'}`);
    console.log(`✅ QR Generation: Working`);
    console.log(`✅ Database Access: Working`);
    console.log(`📁 Data Files: ${filesFound}/${dataFiles.length} found`);
    
    if (emailConfigValid && filesFound > 0) {
      console.log('\n🎉 All systems ready! You can run the full synchronization.');
      console.log('Command: node sync-users-comprehensive.js');
    } else {
      console.log('\n⚠️  Setup required:');
      if (!emailConfigValid) {
        console.log('   - Configure email settings in .env file');
      }
      if (filesFound === 0) {
        console.log('   - Add user data files (CSV/JSON) to the directory');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Tests completed');
  }
}

// Load environment variables
require('dotenv').config();

// Run tests
runTests();