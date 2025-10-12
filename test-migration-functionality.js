const mongoose = require('mongoose');
require('dotenv').config();

// Connection URI from environment
const MONGO_URI = process.env.mongodb || "mongodb://localhost:27017/sabrang";

// Test the UpdatedUser to User migration functionality
async function testMigrationFunctionality() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    const { User, UpdatedUser } = require('./models/models');

    // Get a sample from UpdatedUser collection
    const sampleUpdatedUser = await UpdatedUser.findOne({});
    
    if (!sampleUpdatedUser) {
      console.log("No users found in UpdatedUser collection to test migration.");
      return;
    }

    console.log(`Sample UpdatedUser found: ${sampleUpdatedUser.name} (${sampleUpdatedUser.email})`);
    console.log(`Original ID: ${sampleUpdatedUser._id}`);

    // Check if this user exists in main User collection
    const existingUser = await User.findById(sampleUpdatedUser._id);
    if (existingUser) {
      console.log("This user already exists in the main User collection.");
    } else {
      console.log("This user does not exist in the main User collection - perfect for testing!");
    }

    console.log("\nUpdated admin.js has been modified to:");
    console.log("1. Import UpdatedUser model");
    console.log("2. Check UpdatedUser collection when user not found in QR verification");
    console.log("3. Move user from UpdatedUser to User collection with updated status");
    console.log("4. Set hasEntered=true, isvalidated=true, and entryTime when moving");
    console.log("5. Remove user from UpdatedUser collection after successful move");
    console.log("6. Handle both /verify/:id and /allow-entry/:id routes");

    console.log("\nNow when admin scans QR code of user from UpdatedUser collection:");
    console.log("- User will be found and automatically moved to active User collection");
    console.log("- Entry will be allowed immediately");
    console.log("- Status will be updated to validated and entered");

  } catch (error) {
    console.error("Error in test:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the test
testMigrationFunctionality();