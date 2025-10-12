const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Connection URI from environment
const MONGO_URI = process.env.mongodb || "mongodb://localhost:27017/sabrang";

// Import email service
const { sendRegistrationEmail } = require('./utils/emailService');

// User data to insert
const userData = {
  name: 'Pankaj Sharma',
  email: 'linemoj384@djkux.com',
  password: '', // Will be set during insertion
  events: ['VISITOR_PASS'],
  isvalidated: true, // Set to true since we're generating QR code
  hasEntered: false,
  entryTime: null,
  isAdmin: false,
  profileImage: '',
  universityIdCard: '',
  contactNo: '', // Not provided
  gender: '', // Not provided
  age: null, // Not provided
  universityName: '', // Not provided
  address: '', // Not provided
  referralCode: '',
  userType: 'participant',
  supportRole: '',
  governmentId: '',
  idType: '',
  visitorPassDays: 1,
  emailSent: false,
  emailSentAt: null,
  emailSentBy: null,
  teamRegistrations: [],
  registrationHistory: [],
  qrPath: '', // Will be set after QR generation
  qrCodeBase64: '', // Will be set after QR generation
  createdAt: new Date(),
  updatedAt: new Date(),
  __v: 0
};

// Function to generate QR code
async function generateQRCode(userId, userName) {
  try {
    console.log(`🔄 Generating QR code for ${userName}...`);
    
    // Create QR code data (user ID)
    const qrData = userId.toString();
    
    // Generate QR code as base64
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });
    
    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = qrCodeBase64.split(',')[1];
    
    console.log(`✅ QR code generated successfully for ${userName}`);
    return base64Data;
    
  } catch (error) {
    console.error(`❌ Error generating QR code for ${userName}:`, error);
    return null;
  }
}

// Main function to add user, generate QR, and send email
async function addPankajSharmaComplete() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    const { User } = require('./models/models');

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log(`❌ User with email ${userData.email} already exists.`);
      console.log(`Existing user: ${existingUser.name} - ID: ${existingUser._id}`);
      return;
    }

    console.log(`🔄 Adding new user: ${userData.name}...`);

    // Hash password
    const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
    userData.password = hashedPassword;

    // Create and save the user first
    const newUser = new User(userData);
    await newUser.save();

    console.log(`✅ User ${userData.name} added with ID: ${newUser._id}`);

    // Generate QR code using the user ID
    const qrCodeBase64 = await generateQRCode(newUser._id, userData.name);
    
    if (qrCodeBase64) {
      // Update user with QR code
      newUser.qrCodeBase64 = qrCodeBase64;
      newUser.qrPath = newUser._id.toString(); // Use user ID as QR path reference
      await newUser.save();
      
      console.log(`✅ QR code generated and saved for ${userData.name}`);
    } else {
      console.log(`⚠️  Failed to generate QR code for ${userData.name}`);
    }

    // Send registration email
    console.log(`📧 Sending registration email to ${userData.email}...`);
    
    const emailData = {
      name: userData.name,
      email: userData.email,
      events: userData.events,
      qrCodeBase64: qrCodeBase64
    };

    const emailResult = await sendRegistrationEmail(userData.email, emailData);

    if (emailResult.success) {
      // Update user email status
      newUser.emailSent = true;
      newUser.emailSentAt = new Date();
      await newUser.save();
      
      console.log(`✅ Registration email sent successfully to ${userData.email}`);
    } else {
      console.log(`❌ Failed to send email: ${emailResult.error}`);
    }

    // Final summary
    console.log(`\n🎉 COMPLETE! Summary for ${userData.name}:`);
    console.log(`📧 Email: ${userData.email}`);
    console.log(`🎫 Event: ${userData.events.join(', ')}`);
    console.log(`🆔 User ID: ${newUser._id}`);
    console.log(`✅ Validated: ${newUser.isvalidated}`);
    console.log(`📱 QR Code: ${qrCodeBase64 ? 'Generated' : 'Failed'}`);
    console.log(`📧 Email Sent: ${newUser.emailSent}`);
    console.log(`📅 Created: ${newUser.createdAt}`);

  } catch (error) {
    console.error("❌ Error in complete user setup:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the complete setup
addPankajSharmaComplete();