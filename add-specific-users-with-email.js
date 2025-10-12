/**
 * Script to add specific new users for Sabrang 2025
 * Includes: Yojit Soni, Farhan Khan, and Lakshay Pateriya
 * 
 * This script will:
 * 1. Create new users in the database
 * 2. Generate QR codes for each user
 * 3. Send registration confirmation emails with QR codes
 * 4. Handle validation and error checking
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User, Event } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');

// User details to add - 3 specific users as requested
const NEW_USERS = [
  {
    name: 'Yojit soni',
    email: 'yoxitt25@gmail.com',
    contactNo: '9024588818',
    gender: 'Male',
    age: 20,
    universityName: 'JECRC UNIVERSITY',
    address: 'B-21 Tara nagar khirni phatak road jhotwar',
    referralCode: '', // Not Available
    events: ['STEP UP'],
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Farhan Khan',
    email: 'farhankhan7861458@gmail.com',
    contactNo: '8890174914',
    gender: 'Male',
    age: 18,
    universityName: 'Jk Lakshmipat University',
    address: 'Sanjaynagar D , joshi marg , Jhotwara',
    referralCode: '2025BBA045',
    events: ['VISITOR PASS'],
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Lakshay pateriya',
    email: 'lakshaypateriya76@gmail.com',
    contactNo: '9664381646',
    gender: 'Male',
    age: 20,
    universityName: 'Jecrc university',
    address: '189 rameswar Dham kedia place murlipura',
    referralCode: 'SPECIALOFFER',
    events: ['VISITOR PASS'],
    password: 'defaultPassword123',
    userType: 'participant'
  }
];

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function checkEventExists(eventName) {
  try {
    const event = await Event.findOne({ name: new RegExp(`^${eventName}$`, 'i') });
    if (event) {
      console.log(`✅ Event found: ${eventName}`);
      return true;
    } else {
      console.warn(`⚠️ Event not found in database: ${eventName}`);
      return false;
    }
  } catch (error) {
    console.warn(`⚠️ Could not verify event existence: ${eventName}`);
    return true; // Assume event exists if we can't check
  }
}

async function addSingleUser(userData) {
  try {
    console.log(`\n👤 Processing user: ${userData.name} (${userData.email})`);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email.toLowerCase().trim() });
    if (existingUser) {
      console.log(`⚠️ User already exists: ${userData.email}`);
      console.log(`   Existing user ID: ${existingUser._id}`);
      console.log(`   Existing events: ${existingUser.events.join(', ')}`);
      return { success: false, error: 'User already exists', user: existingUser };
    }
    
    // Validate events exist
    console.log(`🎭 Validating events: ${userData.events.join(', ')}`);
    for (const eventName of userData.events) {
      await checkEventExists(eventName);
    }
    
    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user object
    const newUser = new User({
      name: userData.name,
      email: userData.email.toLowerCase().trim(),
      contactNo: userData.contactNo,
      password: hashedPassword,
      gender: userData.gender,
      age: userData.age,
      universityName: userData.universityName,
      address: userData.address,
      referralCode: userData.referralCode || '',
      events: userData.events,
      userType: userData.userType || 'participant',
      isvalidated: true, // Set as validated since this is direct admin addition
      hasEntered: false,
      entryTime: null,
      isAdmin: false,
      profileImage: '',
      universityIdCard: '',
      supportRole: '',
      governmentId: '',
      idType: '',
      visitorPassDays: userData.events.includes('VISITOR PASS') ? 1 : 0,
      teamRegistrations: [],
      registrationHistory: [],
      emailSent: false,
      emailSentAt: null,
      emailSentBy: null,
      finalPrice: 0, // Set to 0 for now, can be updated later
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save user to get the ID
    await newUser.save();
    console.log(`✅ User created with ID: ${newUser._id}`);
    
    // Generate QR code
    console.log('🔄 Generating QR code...');
    try {
      const qrCodeBase64 = await generateUserQRCode(newUser._id, {
        name: newUser.name,
        email: newUser.email,
        events: newUser.events,
        userId: newUser._id
      });
      
      if (qrCodeBase64) {
        newUser.qrPath = `qr_${newUser._id}.png`;
        newUser.qrCodeBase64 = qrCodeBase64;
        await newUser.save();
        console.log('✅ QR code generated and saved as Base64');
        console.log(`   QR code length: ${qrCodeBase64.length} characters`);
      } else {
        throw new Error('QR code generation returned null');
      }
    } catch (qrError) {
      console.error('❌ QR code generation failed:', qrError.message);
      return { success: false, error: `QR code generation failed: ${qrError.message}`, user: newUser };
    }
    
    // Send registration email with QR code
    console.log('📧 Sending registration email with QR code...');
    try {
      const emailData = {
        name: newUser.name,
        events: newUser.events,
        qrCodeBase64: newUser.qrCodeBase64
      };
      
      const emailResult = await sendRegistrationEmail(newUser.email, emailData);
      
      if (emailResult.success) {
        newUser.emailSent = true;
        newUser.emailSentAt = new Date();
        newUser.emailSentBy = 'admin_script';
        await newUser.save();
        console.log('✅ Registration email sent successfully with QR code attachment');
      } else {
        console.error('⚠️ Email sending failed:', emailResult.error);
        return { success: true, warning: `User created but email failed: ${emailResult.error}`, user: newUser };
      }
    } catch (emailError) {
      console.error('⚠️ Email sending error:', emailError.message);
      return { success: true, warning: `User created but email failed: ${emailError.message}`, user: newUser };
    }
    
    console.log(`🎉 User successfully added: ${newUser.name}`);
    console.log(`   User ID: ${newUser._id}`);
    console.log(`   Events: ${newUser.events.join(', ')}`);
    console.log(`   QR Code: Generated and emailed`);
    console.log(`   Registration Email: Sent to ${newUser.email}`);
    
    return { success: true, user: newUser };
    
  } catch (error) {
    console.error(`❌ Failed to add user ${userData.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function addSpecificUsers() {
  try {
    console.log('🚀 Starting specific user addition process...');
    console.log(`👥 Users to add: ${NEW_USERS.length}`);
    
    // Display users to be added
    console.log('\n📋 Users to be processed:');
    NEW_USERS.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
      console.log(`      Contact: ${user.contactNo}`);
      console.log(`      Institution: ${user.universityName}`);
      console.log(`      Events: ${user.events.join(', ')}`);
      console.log(`      Referral: ${user.referralCode || 'None'}`);
    });
    
    await connectToDatabase();
    
    const results = {
      successful: [],
      failed: [],
      warnings: []
    };
    
    // Process each user
    for (let i = 0; i < NEW_USERS.length; i++) {
      const userData = NEW_USERS[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing ${i + 1}/${NEW_USERS.length}: ${userData.name}`);
      console.log(`${'='.repeat(80)}`);
      
      const result = await addSingleUser(userData);
      
      if (result.success) {
        if (result.warning) {
          results.warnings.push({
            user: userData.name,
            email: userData.email,
            contact: userData.contactNo,
            warning: result.warning,
            userId: result.user._id,
            events: result.user.events
          });
        } else {
          results.successful.push({
            user: userData.name,
            email: userData.email,
            contact: userData.contactNo,
            userId: result.user._id,
            events: result.user.events,
            qrGenerated: !!result.user.qrCodeBase64,
            emailSent: result.user.emailSent
          });
        }
      } else {
        results.failed.push({
          user: userData.name,
          email: userData.email,
          contact: userData.contactNo,
          error: result.error
        });
      }
      
      // Add a delay between users to avoid overwhelming the system
      if (i < NEW_USERS.length - 1) {
        console.log('⏳ Waiting 3 seconds before next user...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Display final results
    console.log('\n' + '='.repeat(100));
    console.log('📊 FINAL RESULTS - SPECIFIC USER ADDITION');
    console.log('='.repeat(100));
    
    if (results.successful.length > 0) {
      console.log(`✅ Successfully Added: ${results.successful.length}`);
      results.successful.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.user} (${user.email})`);
        console.log(`      Contact: ${user.contact}`);
        console.log(`      User ID: ${user.userId}`);
        console.log(`      Events: ${user.events.join(', ')}`);
        console.log(`      QR Code: ${user.qrGenerated ? '✅ Generated' : '❌ Failed'}`);
        console.log(`      Email: ${user.emailSent ? '✅ Sent' : '❌ Failed'}`);
      });
    }
    
    if (results.warnings.length > 0) {
      console.log(`\n⚠️  Added with Warnings: ${results.warnings.length}`);
      results.warnings.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.user} (${user.email})`);
        console.log(`      Contact: ${user.contact}`);
        console.log(`      User ID: ${user.userId}`);
        console.log(`      Events: ${user.events.join(', ')}`);
        console.log(`      Warning: ${user.warning}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length}`);
      results.failed.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.user} (${user.email})`);
        console.log(`      Contact: ${user.contact}`);
        console.log(`      Error: ${user.error}`);
      });
    }
    
    console.log(`\n📈 Summary: ${results.successful.length + results.warnings.length}/${NEW_USERS.length} users processed successfully`);
    
    // Display next steps
    if (results.successful.length > 0 || results.warnings.length > 0) {
      console.log('\n📋 NEXT STEPS:');
      console.log('1. ✅ Users have been created with validated status');
      console.log('2. ✅ QR codes generated and stored as Base64');
      console.log('3. ✅ Registration emails sent with QR code attachments');
      console.log('4. 📧 Users should check their email for registration confirmation');
      console.log('5. 🔐 Default password: defaultPassword123 (users should change it)');
      console.log('6. 🎫 QR codes can be accessed via admin panel or /qrcode/:id endpoint');
      console.log('7. 🚪 Users are ready for entry verification');
    }
    
    // Display user credentials for reference
    if (results.successful.length > 0) {
      console.log('\n🔐 USER CREDENTIALS FOR REFERENCE:');
      results.successful.forEach((user, index) => {
        console.log(`   ${index + 1}. Email: ${user.email}`);
        console.log(`      Password: defaultPassword123`);
        console.log(`      User ID: ${user.userId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Script execution failed:', error);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n📴 Disconnected from MongoDB');
    } catch (disconnectError) {
      console.error('❌ Error disconnecting:', disconnectError);
    }
  }
}

// Load environment variables
require('dotenv').config();

// Validate environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL', 'mongodb'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  if (missingVars.some(v => ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'].includes(v))) {
    console.log('⚠️ Users will be created but emails may not be sent');
  }
  if (missingVars.includes('mongodb')) {
    console.log('⚠️ Database connection may fail');
  }
}

// Run the script
console.log('🎯 SABRANG 2025 - SPECIFIC USER ADDITION SCRIPT');
console.log('='.repeat(50));
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`👤 Users to process: ${NEW_USERS.length}`);
console.log('');

console.log('📋 USER DETAILS:');
NEW_USERS.forEach((user, index) => {
  console.log(`   ${index + 1}. ${user.name} (${user.email})`);
  console.log(`      📞 ${user.contactNo} | 🎓 ${user.universityName}`);
  console.log(`      🎭 Events: ${user.events.join(', ')}`);
  console.log(`      🏷️  Referral: ${user.referralCode || 'None'}`);
});

console.log('\n⚠️ IMPORTANT NOTES:');
console.log('- Default password for all users: defaultPassword123');
console.log('- Users will be set as validated (isvalidated: true)');
console.log('- QR codes will be generated automatically as Base64');
console.log('- Registration emails will be sent with QR code attachments');
console.log('- Users will be ready for entry verification immediately');
console.log('- Check the results carefully for any warnings or errors');

console.log('\n🚀 Starting in 5 seconds...');
setTimeout(() => {
  addSpecificUsers();
}, 5000); // 5 second delay to read the information