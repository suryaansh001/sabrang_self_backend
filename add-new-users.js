/**
 * Script to add new users to the database with QR code generation and email sending
 * 
 * This script will:
 * 1. Create new users in the database
 * 2. Generate QR codes for each user
 * 3. Send registration confirmation emails
 * 4. Handle validation and error checking
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User, Event } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');

// User details to add - you can modify this array to add multiple users
const NEW_USERS = [
  {
    name: 'Tejender Singh Shekhawat',
    email: 'tejendersinghshekhawat@jklu.edu.in',
    contactNo: '9636667956',
    gender: 'Male',
    age: 19,
    universityName: 'JK Lakshmipat University',
    address: 'F-53B, Ram nagar extension, sodala, jaipur, rajasthan',
    referralCode: '2024Btech030',
    events: ['BIDDING BEFORE WICKET'],
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Dev Yadav',
    email: 'devyadav@jklu.edu.in',
    contactNo: '9509549432',
    gender: 'Male', // Not specified, assuming Male
    age: 19, // Not specified, assuming 19
    universityName: 'JK Lakshmipat University',
    address: '', // Not provided
    referralCode: '',
    events: [], // No event specified, will be empty
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Tanishq Rathore',
    email: 'tanishqrathore21105@gmail.com',
    contactNo: '7231990208',
    gender: 'Male',
    age: 19,
    universityName: 'Jk lakshmipat univwrsity',
    address: '59 Girdhar Vihar Panchawala',
    referralCode: 'EARLYBIRD',
    events: ['IN CONVERSATION WITH'],
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Shaik Areesh',
    email: 'shaikareesh@jklu.edu.in',
    contactNo: '7095149312',
    gender: 'Female',
    age: 19,
    universityName: 'Jk laxmipat university',
    address: 'Hyderbad',
    referralCode: 'EARLYBIRD',
    events: ['DUMB SHOW'],
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Garvit Raheja',
    email: 'garvitraheja07@gmail.com',
    contactNo: '7737975858',
    gender: 'Male',
    age: 19,
    universityName: 'JK Lakshmipat University',
    address: '40 Mithila Vihar-1 Jagatpura Jaipur',
    referralCode: '', // "Not Available" - setting as empty
    events: ['VERSEVAAD', 'BIDDING BEFORE WICKET'], // Multiple events mentioned
    password: 'defaultPassword123',
    userType: 'participant'
  },
  {
    name: 'Divyaraj Singh',
    email: 'divyarajsingh532@gmail.com',
    contactNo: '8769399707',
    gender: 'Male',
    age: 22,
    universityName: 'Jecrc foundation',
    address: 'Pratapnagar jaipur',
    referralCode: '2025BBA107',
    events: ['Visitor Pass'], // Visitor Pass (1 day only)
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
    return !!event;
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
      return { success: false, error: 'User already exists', user: existingUser };
    }
    
    // Validate events exist (optional check)
    console.log(`🎭 Validating events: ${userData.events.join(', ')}`);
    for (const eventName of userData.events) {
      const eventExists = await checkEventExists(eventName);
      if (!eventExists) {
        console.warn(`⚠️ Event may not exist in database: ${eventName}`);
      }
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
      visitorPassDays: 0,
      teamRegistrations: [],
      registrationHistory: [],
      emailSent: false,
      emailSentAt: null,
      emailSentBy: null,
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
        console.log('✅ QR code generated and saved');
      } else {
        throw new Error('QR code generation returned null');
      }
    } catch (qrError) {
      console.error('❌ QR code generation failed:', qrError.message);
      return { success: false, error: `QR code generation failed: ${qrError.message}`, user: newUser };
    }
    
    // Send registration email
    console.log('📧 Sending registration email...');
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
        await newUser.save();
        console.log('✅ Registration email sent successfully');
      } else {
        console.error('⚠️ Email sending failed:', emailResult.error);
        return { success: true, warning: `User created but email failed: ${emailResult.error}`, user: newUser };
      }
    } catch (emailError) {
      console.error('⚠️ Email sending error:', emailError.message);
      return { success: true, warning: `User created but email failed: ${emailError.message}`, user: newUser };
    }
    
    console.log(`🎉 User successfully added: ${newUser.name}`);
    return { success: true, user: newUser };
    
  } catch (error) {
    console.error(`❌ Failed to add user ${userData.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function addNewUsers() {
  try {
    console.log('🚀 Starting new user addition process...');
    console.log(`👥 Users to add: ${NEW_USERS.length}`);
    
    await connectToDatabase();
    
    const results = {
      successful: [],
      failed: [],
      warnings: []
    };
    
    // Process each user
    for (let i = 0; i < NEW_USERS.length; i++) {
      const userData = NEW_USERS[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing ${i + 1}/${NEW_USERS.length}: ${userData.name}`);
      console.log(`${'='.repeat(60)}`);
      
      const result = await addSingleUser(userData);
      
      if (result.success) {
        if (result.warning) {
          results.warnings.push({
            user: userData.name,
            email: userData.email,
            warning: result.warning,
            userId: result.user._id
          });
        } else {
          results.successful.push({
            user: userData.name,
            email: userData.email,
            userId: result.user._id,
            events: result.user.events
          });
        }
      } else {
        results.failed.push({
          user: userData.name,
          email: userData.email,
          error: result.error
        });
      }
      
      // Add a small delay between users to avoid overwhelming the system
      if (i < NEW_USERS.length - 1) {
        console.log('⏳ Waiting 2 seconds before next user...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Display final results
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(80));
    
    console.log(`✅ Successfully Added: ${results.successful.length}`);
    results.successful.forEach(user => {
      console.log(`   - ${user.user} (${user.email}) - ID: ${user.userId}`);
      console.log(`     Events: ${user.events.join(', ')}`);
    });
    
    if (results.warnings.length > 0) {
      console.log(`\n⚠️  Added with Warnings: ${results.warnings.length}`);
      results.warnings.forEach(user => {
        console.log(`   - ${user.user} (${user.email}) - ID: ${user.userId}`);
        console.log(`     Warning: ${user.warning}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length}`);
      results.failed.forEach(user => {
        console.log(`   - ${user.user} (${user.email}): ${user.error}`);
      });
    }
    
    console.log(`\n📈 Summary: ${results.successful.length + results.warnings.length}/${NEW_USERS.length} users processed successfully`);
    
    // Display next steps
    if (results.successful.length > 0 || results.warnings.length > 0) {
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Verify users can log in with their email and default password');
      console.log('2. Check that QR codes are accessible via /qrcode/:id endpoint');
      console.log('3. Confirm registration emails were received');
      console.log('4. Users should change their passwords after first login');
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
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables for email:', missingVars.join(', '));
  console.log('⚠️ Users will be created but emails may not be sent');
}

// Run the script
console.log('🎯 NEW USER ADDITION SCRIPT');
console.log('==========================');
console.log(`📅 Date: ${new Date().toLocaleString()}`);
console.log(`👤 Users to process: ${NEW_USERS.length}`);

NEW_USERS.forEach((user, index) => {
  console.log(`   ${index + 1}. ${user.name} (${user.email}) - Events: ${user.events.join(', ')}`);
});

console.log('\n⚠️ IMPORTANT NOTES:');
console.log('- Default password for all users: defaultPassword123');
console.log('- Users are set as validated (isvalidated: true)');
console.log('- QR codes will be generated automatically');
console.log('- Registration emails will be sent if email config is available');
console.log('- Check the results carefully for any warnings or errors');

setTimeout(() => {
  addNewUsers();
}, 3000); // 3 second delay to read the information