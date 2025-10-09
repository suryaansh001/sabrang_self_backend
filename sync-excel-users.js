/**
 * Simple User Sync Script - Excel File Only
 * Processes only the attached Excel file (27 entries)
 * Adds missing users and generates QR codes (no emails for now)
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
const fs = require('fs');
const path = require('path');

// Team events configuration
const TEAM_EVENTS = [
  'DANCE BATTLE',
  'BIDDING BEFORE WICKET',
  'TREASURE HUNT',
  'QUIZ COMPETITION',
  'DEBATE COMPETITION',
  'CASE STUDY COMPETITION',
  'BUSINESS PLAN COMPETITION'
];

const INDIVIDUAL_EVENTS = [
  'STEP UP',
  'SINGING COMPETITION',
  'POETRY RECITATION',
  'STAND UP COMEDY',
  'FASHION SHOW'
];

// Generate base64 QR code from ObjectID
function generateBase64QRCode(objectId) {
  return Buffer.from(objectId.toString()).toString('base64');
}

// Parse CSV data
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/["\r]/g, ''));
  const users = [];
  
  console.log('📋 CSV Headers found:', headers);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV parsing with proper quote handling
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Add the last value
    
    const user = {};
    headers.forEach((header, index) => {
      user[header] = values[index] || '';
    });
    
    // Extract user data with various possible field names
    const extractedUser = {
      name: user.name || user.Name || user.userName || user['User Name'] || 'Unknown',
      email: (user.email || user.collegeMailId || user.Email || user['College Mail ID'] || '').toLowerCase().trim(),
      contactNo: user.contactNo || user.Contact || user.phone || user['Contact No'] || '',
      events: user.events ? user.events.split(';').map(e => e.trim()) : [],
      universityName: user.universityName || user.University || user['University Name'] || '',
      gender: user.gender || user.Gender || '',
      age: user.age ? parseInt(user.age) : null,
      address: user.address || user.Address || '',
      source: 'excel'
    };
    
    if (extractedUser.email) {
      users.push(extractedUser);
    }
  }
  
  return users;
}

async function syncExcelUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('📊 EXCEL FILE USER SYNCHRONIZATION');
    console.log('=' .repeat(60));
    
    // Look for the Excel/CSV file - check common names
    const possibleFiles = [
      'users.csv',
      'registrations.csv',
      'data.csv',
      'export.csv',
      'sabrang_users.csv',
      'user_list.csv'
    ];
    
    let csvFile = null;
    let csvContent = '';
    
    // Check for any CSV file in the directory
    const files = fs.readdirSync('./').filter(f => f.endsWith('.csv'));
    console.log('📁 Found CSV files:', files);
    
    if (files.length === 0) {
      console.log('❌ No CSV files found in current directory');
      console.log('💡 Please ensure your Excel file is saved as CSV format');
      return;
    }
    
    // Use the most recent or first CSV file
    csvFile = files[0]; // You can modify this to pick the right file
    console.log(`📄 Processing file: ${csvFile}`);
    
    try {
      csvContent = fs.readFileSync(csvFile, 'utf8');
    } catch (error) {
      console.log(`❌ Error reading ${csvFile}:`, error.message);
      return;
    }
    
    // Parse the CSV
    console.log('\n📋 PARSING CSV DATA:');
    console.log('-' .repeat(40));
    
    const usersFromFile = parseCSV(csvContent);
    console.log(`📊 Found ${usersFromFile.length} users in ${csvFile}`);
    
    if (usersFromFile.length === 0) {
      console.log('❌ No valid users found in CSV file');
      return;
    }
    
    // Show first few users for verification
    console.log('\n👥 SAMPLE USERS FROM FILE:');
    console.log('-' .repeat(40));
    usersFromFile.slice(0, 3).forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Contact: ${user.contactNo}`);
      console.log(`   University: ${user.universityName}`);
      console.log(`   Events: [${user.events.join(', ')}]`);
      console.log('');
    });
    
    // Get existing users from database
    console.log('🔍 CHECKING EXISTING USERS IN DATABASE:');
    console.log('-' .repeat(40));
    
    const existingUsers = await User.find({}).select('_id name email contactNo events universityName qrCodeBase64');
    const existingEmailMap = new Map();
    
    existingUsers.forEach(user => {
      existingEmailMap.set(user.email.toLowerCase(), user);
    });
    
    console.log(`📊 Existing users in database: ${existingUsers.length}`);
    
    // Process each user from the file
    console.log('\n👥 PROCESSING USERS:');
    console.log('-' .repeat(40));
    
    let newUsersCount = 0;
    let updatedUsersCount = 0;
    let verifiedUsersCount = 0;
    let qrGeneratedCount = 0;
    
    for (let i = 0; i < usersFromFile.length; i++) {
      const userData = usersFromFile[i];
      const email = userData.email.toLowerCase();
      
      console.log(`\n${i + 1}/${usersFromFile.length}. Processing: ${userData.name} (${email})`);
      
      let user = existingEmailMap.get(email);
      let isNewUser = false;
      let wasUpdated = false;
      
      if (!user) {
        // Create new user
        console.log('   ➕ Creating new user');
        
        const newUserData = {
          name: userData.name,
          email: email,
          contactNo: userData.contactNo || '',
          events: userData.events || [],
          universityName: userData.universityName || '',
          gender: userData.gender || '',
          age: userData.age || null,
          address: userData.address || '',
          isvalidated: true,
          password: 'temp_' + Math.random().toString(36).slice(-8) // Temporary password
        };
        
        user = new User(newUserData);
        await user.save();
        
        isNewUser = true;
        newUsersCount++;
        
        console.log(`   ✅ Created with ID: ${user._id}`);
      } else {
        // Verify and update existing user
        console.log('   🔍 Verifying existing user');
        
        const updates = {};
        let hasChanges = false;
        
        // Check each field
        if (userData.name && userData.name !== user.name) {
          updates.name = userData.name;
          hasChanges = true;
          console.log(`   📝 Name: "${user.name}" → "${userData.name}"`);
        }
        
        if (userData.contactNo && userData.contactNo !== user.contactNo) {
          updates.contactNo = userData.contactNo;
          hasChanges = true;
          console.log(`   📱 Contact: "${user.contactNo}" → "${userData.contactNo}"`);
        }
        
        if (userData.universityName && userData.universityName !== user.universityName) {
          updates.universityName = userData.universityName;
          hasChanges = true;
          console.log(`   🏫 University: "${user.universityName}" → "${userData.universityName}"`);
        }
        
        // Merge events
        if (userData.events && userData.events.length > 0) {
          const existingEvents = user.events || [];
          const newEvents = [...new Set([...existingEvents, ...userData.events])];
          if (newEvents.length !== existingEvents.length) {
            updates.events = newEvents;
            hasChanges = true;
            console.log(`   🎯 Events: [${existingEvents.join(', ')}] → [${newEvents.join(', ')}]`);
          }
        }
        
        if (hasChanges) {
          await User.findByIdAndUpdate(user._id, updates);
          user = { ...user.toObject(), ...updates }; // Update local copy
          wasUpdated = true;
          updatedUsersCount++;
          console.log('   ✅ Updated user details');
        } else {
          verifiedUsersCount++;
          console.log('   ✅ User details verified (no changes needed)');
        }
      }
      
      // Generate QR code if missing
      if (!user.qrCodeBase64 || isNewUser) {
        const qrCode = generateBase64QRCode(user._id);
        await User.findByIdAndUpdate(user._id, { qrCodeBase64: qrCode });
        user.qrCodeBase64 = qrCode;
        qrGeneratedCount++;
        console.log(`   📱 Generated QR code: ${qrCode}`);
      } else {
        console.log(`   📱 QR code already exists: ${user.qrCodeBase64}`);
      }
    }
    
    // Final summary
    console.log('\n📊 SYNCHRONIZATION SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`👥 Total users processed: ${usersFromFile.length}`);
    console.log(`➕ New users created: ${newUsersCount}`);
    console.log(`🔄 Existing users updated: ${updatedUsersCount}`);
    console.log(`✅ Users verified (no changes): ${verifiedUsersCount}`);
    console.log(`📱 QR codes generated: ${qrGeneratedCount}`);
    
    // Check QR codes status
    console.log('\n📱 QR CODES STATUS:');
    const totalUsersWithQR = await User.countDocuments({ 
      qrCodeBase64: { $exists: true, $ne: null, $ne: '' } 
    });
    const totalUsers = await User.countDocuments();
    console.log(`✅ Users with QR codes: ${totalUsersWithQR}/${totalUsers}`);
    
    console.log('\n🎉 EXCEL FILE SYNCHRONIZATION COMPLETED!');
    console.log('📧 Email sending will be handled separately');
    
    return {
      totalProcessed: usersFromFile.length,
      newUsers: newUsersCount,
      updatedUsers: updatedUsersCount,
      verifiedUsers: verifiedUsersCount,
      qrGenerated: qrGeneratedCount
    };
    
  } catch (error) {
    console.error('❌ Error in user synchronization:', error);
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
  syncExcelUsers,
  generateBase64QRCode
};

// Run the script if called directly
if (require.main === module) {
  syncExcelUsers();
}