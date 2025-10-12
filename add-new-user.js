const mongoose = require('mongoose');
require('dotenv').config();

// Connection URI from environment
const MONGO_URI = process.env.mongodb || "mongodb://localhost:27017/sabrang";

// User data to insert
const userData = {
  name: 'Riddhi Khandelwal',
  email: 'riddhikhandelwal@jklu.edu.in',
  password: '$2b$12$placeholder.hash.for.new.user', // Placeholder password hash
  events: ['ART RELAY'],
  qrPath: null,
  qrCodeBase64: null,
  isvalidated: false, // New user, not validated yet
  hasEntered: false,
  entryTime: null,
  isAdmin: false,
  profileImage: '',
  universityIdCard: '',
  contactNo: '9256443544',
  gender: 'Female',
  age: 20,
  universityName: 'JK lakshmipat university',
  address: 'Jaipur Rajasthan',
  referralCode: '',
  userType: 'participant',
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
  updatedAt: new Date(),
  __v: 0
};

// Function to connect to MongoDB and insert user
async function addNewUserToDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    const { User } = require('./models/models');

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log(`User with email ${userData.email} already exists. Skipping insertion.`);
      return;
    }

    // Insert the user
    const newUser = new User(userData);
    await newUser.save();

    console.log(`New user ${userData.name} (${userData.email}) has been successfully added to the database.`);
    console.log(`Event: ${userData.events.join(', ')}`);
    console.log(`Contact: ${userData.contactNo}`);
    console.log(`Institution: ${userData.universityName}`);

  } catch (error) {
    console.error("Error adding user to database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the insertion
addNewUserToDatabase();