/**
 * Simple CSV User Sync Script
 * Processes cashfreeorderformfinal.csv to:
 * 1. Check if users exist in database
 * 2. Add missing users with base64 QR codes
 * 3. Skip email sending for now
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const fs = require('fs');
const path = require('path');

// Generate base64 QR code from ObjectID
function generateBase64QRCode(objectId) {
  return Buffer.from(objectId.toString()).toString('base64');
}

// Parse CSV content
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const users = [];
  
  console.log('📋 CSV Headers:', headers);
  console.log('📊 Total lines in CSV:', lines.length);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV parsing with potential commas in quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add the last value
    
    if (values.length >= 2 && values[1]) { // At least name and email
      const user = {
        name: values[0] || 'Unknown',
        email: values[1].toLowerCase().trim(),
        contactNo: values[2] || '',
        gender: values[3] || '',
        age: values[4] ? parseInt(values[4]) : null,
        universityName: values[5] || '',
        address: values[7] || '',
        events: values[8] ? [values[8].trim()] : [],
        referralCode: values[9] || ''
      };
      
      if (user.email && user.email.includes('@')) {
        users.push(user);
        console.log(`📝 Parsed: ${user.name} (${user.email}) - Events: ${user.events.join(', ')}`);
      }
    }
  }
  
  return users;
}

async function syncCashfreeUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 CASHFREE CSV USER SYNCHRONIZATION');
    console.log('=' .repeat(80));
    
    // Read CSV file
    const csvPath = path.join(__dirname, 'public', 'cashfreeorderformfinal.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      return;
    }
    
    console.log('\n📁 LOADING CSV FILE:');
    console.log('-' .repeat(50));
    console.log('📂 Reading:', csvPath);
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const usersFromCSV = parseCSV(csvContent);
    
    console.log(`\n📊 Found ${usersFromCSV.length} valid users in CSV`);
    
    // Get existing users from database
    console.log('\n🔍 CHECKING EXISTING USERS:');
    console.log('-' .repeat(50));
    
    const existingUsers = await User.find({}).select('_id name email contactNo events universityName qrCodeBase64');
    const existingEmailMap = new Map();
    
    existingUsers.forEach(user => {
      existingEmailMap.set(user.email.toLowerCase(), user);
    });
    
    console.log(`📊 Total users in database: ${existingUsers.length}`);
    
    // Process users
    let newUsersCount = 0;
    let existingUsersCount = 0;
    let updatedUsersCount = 0;
    
    console.log('\n👥 PROCESSING USERS:');
    console.log('-' .repeat(50));
    
    for (let i = 0; i < usersFromCSV.length; i++) {
      const userData = usersFromCSV[i];
      const email = userData.email.toLowerCase();
      
      console.log(`\n${i + 1}/${usersFromCSV.length}. Processing: ${userData.name} (${email})`);
      
      let user = existingEmailMap.get(email);
      
      if (!user) {
        // Create new user
        console.log('   ➕ Creating new user...');
        
        const newUserData = {
          name: userData.name,
          email: email,
          contactNo: userData.contactNo || '',
          gender: userData.gender || '',
          age: userData.age || null,
          universityName: userData.universityName || '',
          address: userData.address || '',
          events: userData.events || [],
          referralCode: userData.referralCode || '',
          isvalidated: true,
          password: 'temp_' + Math.random().toString(36).slice(-8)
        };
        
        user = new User(newUserData);
        await user.save();
        
        newUsersCount++;
        console.log(`   ✅ Created with ID: ${user._id}`);
        
        // Generate QR code
        const qrCode = generateBase64QRCode(user._id);
        await User.findByIdAndUpdate(user._id, { qrCodeBase64: qrCode });
        console.log(`   📱 Generated QR code: ${qrCode}`);
        
      } else {
        // User exists - check for updates
        console.log('   🔍 User exists, checking for updates...');
        existingUsersCount++;
        
        const updates = {};
        let hasChanges = false;
        
        // Check and update fields
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
          updatedUsersCount++;
          console.log('   ✅ Updated user details');
        } else {
          console.log('   ✅ No changes needed');
        }
        
        // Generate QR code if missing
        if (!user.qrCodeBase64) {
          const qrCode = generateBase64QRCode(user._id);
          await User.findByIdAndUpdate(user._id, { qrCodeBase64: qrCode });
          console.log(`   📱 Generated missing QR code: ${qrCode}`);
        } else {
          console.log(`   📱 QR code exists: ${user.qrCodeBase64}`);
        }
      }
    }
    
    // Summary
    console.log('\n📊 SYNCHRONIZATION SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`📁 CSV file processed: cashfreeorderformfinal.csv`);
    console.log(`👥 Total users in CSV: ${usersFromCSV.length}`);
    console.log(`➕ New users created: ${newUsersCount}`);
    console.log(`🔄 Existing users updated: ${updatedUsersCount}`);
    console.log(`✅ Existing users (no changes): ${existingUsersCount - updatedUsersCount}`);
    
    // Verify QR codes
    console.log('\n📱 QR CODE VERIFICATION:');
    console.log('-' .repeat(50));
    
    const processedEmails = usersFromCSV.map(u => u.email.toLowerCase());
    const processedUsers = await User.find({ 
      email: { $in: processedEmails } 
    }).select('name email qrCodeBase64');
    
    let qrCount = 0;
    for (const user of processedUsers) {
      if (user.qrCodeBase64) {
        qrCount++;
        const decoded = Buffer.from(user.qrCodeBase64, 'base64').toString('utf8');
        const isValid = decoded === user._id.toString();
        console.log(`✅ ${user.name}: QR valid: ${isValid ? 'Yes' : 'No'}`);
      } else {
        console.log(`❌ ${user.name}: No QR code`);
      }
    }
    
    console.log(`\n📊 QR Code Status: ${qrCount}/${processedUsers.length} users have valid QR codes`);
    
    // Event breakdown
    console.log('\n🎯 EVENT BREAKDOWN:');
    console.log('-' .repeat(50));
    
    const eventCounts = {};
    for (const user of usersFromCSV) {
      for (const event of user.events) {
        eventCounts[event] = (eventCounts[event] || 0) + 1;
      }
    }
    
    for (const [event, count] of Object.entries(eventCounts)) {
      console.log(`${event}: ${count} participants`);
    }
    
    console.log('\n🎉 CSV SYNCHRONIZATION COMPLETED!');
    console.log('📧 Email sending skipped as requested');
    
    return {
      totalUsers: usersFromCSV.length,
      newUsers: newUsersCount,
      updatedUsers: updatedUsersCount,
      existingUsers: existingUsersCount,
      qrCodesGenerated: qrCount
    };
    
  } catch (error) {
    console.error('❌ Error in CSV synchronization:', error);
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
  syncCashfreeUsers,
  generateBase64QRCode,
  parseCSV
};

// Run the script if called directly
if (require.main === module) {
  syncCashfreeUsers();
}