/**
 * Comprehensive User Synchronization Script
 * 1. Ensures users exist in database, adds missing ones
 * 2. Generates base64 QR codes from ObjectID
 * 3. Sends confirmation emails
 * 4. Handles team events separately
 * 5. Creates team compositions with empty member details
 * 6. Verifies existing user details match
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');
const { sendEmailWithRetry, testEmailConfig } = require('./email-service');
const fs = require('fs');
const path = require('path');

// Configuration
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

// Load user data from various sources
async function loadUserDataSources() {
  const dataSources = [];
  
  // Check for CSV files
  const csvFiles = [
    'rawusers.csv',
    'sabrang_registrations_2025-10-06.csv',
    'sabrang_registrations_2025-10-07.csv',
    'purchases_2025-10-06.csv',
    'purchases_2025-10-07.csv'
  ];
  
  for (const csvFile of csvFiles) {
    const filePath = path.join(__dirname, csvFile);
    if (fs.existsSync(filePath)) {
      console.log(`📁 Found CSV file: ${csvFile}`);
      dataSources.push({
        type: 'csv',
        path: filePath,
        name: csvFile
      });
    }
  }
  
  // Check for JSON files
  const jsonFiles = [
    'teamcompositions_2025-10-06.json',
    'teamcompositions_2025-10-07.json',
    'missing_qr_users_2025-10-08.json',
    'missing_qr_team_members_2025-10-08.json'
  ];
  
  for (const jsonFile of jsonFiles) {
    const filePath = path.join(__dirname, jsonFile);
    if (fs.existsSync(filePath)) {
      console.log(`📁 Found JSON file: ${jsonFile}`);
      dataSources.push({
        type: 'json',
        path: filePath,
        name: jsonFile
      });
    }
  }
  
  return dataSources;
}

// Parse CSV data
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const users = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const user = {};
    
    headers.forEach((header, index) => {
      user[header] = values[index] || '';
    });
    
    if (user.email || user.collegeMailId) {
      users.push({
        name: user.name || user.Name || 'Unknown',
        email: user.email || user.collegeMailId || user.Email,
        contactNo: user.contactNo || user.Contact || user.phone || '',
        events: user.events ? user.events.split(';') : [],
        universityName: user.universityName || user.University || '',
        gender: user.gender || user.Gender || '',
        age: user.age ? parseInt(user.age) : null,
        address: user.address || user.Address || '',
        source: 'csv'
      });
    }
  }
  
  return users;
}

// Main synchronization function
async function syncUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 COMPREHENSIVE USER SYNCHRONIZATION');
    console.log('=' .repeat(80));
    
    // Test email configuration first
    console.log('\n📧 TESTING EMAIL CONFIGURATION:');
    console.log('-' .repeat(50));
    const emailConfigValid = await testEmailConfig();
    if (!emailConfigValid) {
      console.log('⚠️  Continuing without email functionality...');
    }
    
    // Load data sources
    console.log('\n📂 LOADING DATA SOURCES:');
    console.log('-' .repeat(50));
    
    const dataSources = await loadUserDataSources();
    let allUsersFromSources = [];
    
    // Process each data source
    for (const source of dataSources) {
      console.log(`\n📁 Processing: ${source.name}`);
      
      try {
        const content = fs.readFileSync(source.path, 'utf8');
        
        if (source.type === 'csv') {
          const users = parseCSV(content);
          console.log(`   📊 Found ${users.length} users in CSV`);
          allUsersFromSources.push(...users);
        } else if (source.type === 'json') {
          const data = JSON.parse(content);
          let users = [];
          
          if (Array.isArray(data)) {
            users = data;
          } else if (data.users) {
            users = data.users;
          } else if (data.teamMembers) {
            users = data.teamMembers;
          }
          
          console.log(`   📊 Found ${users.length} users in JSON`);
          allUsersFromSources.push(...users.map(u => ({
            ...u,
            source: 'json'
          })));
        }
      } catch (error) {
        console.log(`   ❌ Error processing ${source.name}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Total users from all sources: ${allUsersFromSources.length}`);
    
    // Remove duplicates by email
    const uniqueUsers = [];
    const seenEmails = new Set();
    
    for (const user of allUsersFromSources) {
      const email = user.email?.toLowerCase().trim();
      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueUsers.push({
          ...user,
          email: email
        });
      }
    }
    
    console.log(`📊 Unique users after deduplication: ${uniqueUsers.length}`);
    
    // Get existing users from database
    console.log('\n🔍 CHECKING EXISTING USERS IN DATABASE:');
    console.log('-' .repeat(50));
    
    const existingUsers = await User.find({}).select('_id name email contactNo events universityName gender age address qrCodeBase64');
    const existingEmailMap = new Map();
    
    existingUsers.forEach(user => {
      existingEmailMap.set(user.email.toLowerCase(), user);
    });
    
    console.log(`📊 Existing users in database: ${existingUsers.length}`);
    
    // Process users
    let newUsersCount = 0;
    let updatedUsersCount = 0;
    let verifiedUsersCount = 0;
    let emailsSentCount = 0;
    const teamEventUsers = [];
    const individualEventUsers = [];
    
    console.log('\n👥 PROCESSING USERS:');
    console.log('-' .repeat(50));
    
    for (let i = 0; i < uniqueUsers.length; i++) {
      const userData = uniqueUsers[i];
      const email = userData.email.toLowerCase();
      
      console.log(`\n${i + 1}/${uniqueUsers.length}. Processing: ${userData.name} (${email})`);
      
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
        console.log(`   📱 Generated QR code: ${qrCode}`);
      }
      
      // Send email for new users or if requested
      if (isNewUser || wasUpdated) {
        const emailSent = await sendEmailWithRetry(user, user.qrCodeBase64);
        if (emailSent) {
          await User.findByIdAndUpdate(user._id, { 
            emailSent: true, 
            emailSentAt: new Date() 
          });
          emailsSentCount++;
          console.log('   📧 Email sent successfully');
        } else {
          console.log('   ❌ Email failed');
        }
      }
      
      // Categorize by event type
      const userEvents = user.events || [];
      const hasTeamEvents = userEvents.some(event => TEAM_EVENTS.includes(event));
      const hasIndividualEvents = userEvents.some(event => INDIVIDUAL_EVENTS.includes(event));
      
      if (hasTeamEvents) {
        teamEventUsers.push({
          ...user,
          teamEvents: userEvents.filter(event => TEAM_EVENTS.includes(event)),
          individualEvents: userEvents.filter(event => INDIVIDUAL_EVENTS.includes(event))
        });
      }
      
      if (hasIndividualEvents) {
        individualEventUsers.push({
          ...user,
          individualEvents: userEvents.filter(event => INDIVIDUAL_EVENTS.includes(event))
        });
      }
    }
    
    // Handle team compositions
    console.log('\n🏆 PROCESSING TEAM COMPOSITIONS:');
    console.log('-' .repeat(50));
    
    const teamCompositionsCreated = [];
    
    // Group team users by event
    const teamUsersByEvent = {};
    teamEventUsers.forEach(user => {
      user.teamEvents.forEach(event => {
        if (!teamUsersByEvent[event]) {
          teamUsersByEvent[event] = [];
        }
        teamUsersByEvent[event].push(user);
      });
    });
    
    for (const [eventName, users] of Object.entries(teamUsersByEvent)) {
      console.log(`\n🎯 Processing team event: ${eventName}`);
      console.log(`   👥 Users registered: ${users.length}`);
      
      // Check if team composition already exists
      const existingTeam = await TeamComposition.findOne({ eventName });
      
      if (!existingTeam) {
        // Create new team composition with empty member details
        const teamComposition = new TeamComposition({
          eventName: eventName,
          teamName: `${eventName} Team`,
          teamLeader: {
            userId: users[0]._id,
            name: users[0].name,
            email: users[0].email,
            hasEntered: false
          },
          teamMembers: [], // Empty for now as requested
          totalMembers: users.length,
          registrationComplete: false, // Set to false since member details are empty
          paymentStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await teamComposition.save();
        teamCompositionsCreated.push(teamComposition);
        
        console.log(`   ✅ Created team composition: ${teamComposition._id}`);
        console.log(`   👑 Team leader: ${users[0].name}`);
        console.log(`   📊 Total members: ${users.length} (details empty for now)`);
      } else {
        console.log(`   ✅ Team composition already exists: ${existingTeam._id}`);
      }
    }
    
    // Final summary
    console.log('\n📊 SYNCHRONIZATION SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`👥 Total users processed: ${uniqueUsers.length}`);
    console.log(`➕ New users created: ${newUsersCount}`);
    console.log(`🔄 Existing users updated: ${updatedUsersCount}`);
    console.log(`✅ Users verified (no changes): ${verifiedUsersCount}`);
    console.log(`📧 Emails sent: ${emailsSentCount}`);
    console.log(`🏆 Team compositions created: ${teamCompositionsCreated.length}`);
    console.log(`👤 Individual event participants: ${individualEventUsers.length}`);
    console.log(`👥 Team event participants: ${teamEventUsers.length}`);
    
    console.log('\n🎯 TEAM EVENTS BREAKDOWN:');
    for (const [eventName, users] of Object.entries(teamUsersByEvent)) {
      console.log(`   ${eventName}: ${users.length} participants`);
    }
    
    console.log('\n📱 QR CODES STATUS:');
    const totalUsersWithQR = await User.countDocuments({ qrCodeBase64: { $exists: true, $ne: null, $ne: '' } });
    const totalUsers = await User.countDocuments();
    console.log(`✅ Users with QR codes: ${totalUsersWithQR}/${totalUsers}`);
    
    console.log('\n🎉 USER SYNCHRONIZATION COMPLETED!');
    
    return {
      totalProcessed: uniqueUsers.length,
      newUsers: newUsersCount,
      updatedUsers: updatedUsersCount,
      verifiedUsers: verifiedUsersCount,
      emailsSent: emailsSentCount,
      teamCompositions: teamCompositionsCreated.length,
      individualUsers: individualEventUsers.length,
      teamUsers: teamEventUsers.length
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
  syncUsers,
  generateBase64QRCode,
  TEAM_EVENTS,
  INDIVIDUAL_EVENTS
};

// Run the script if called directly
if (require.main === module) {
  syncUsers();
}