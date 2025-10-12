const mongoose = require('mongoose');
require('dotenv').config();

// Connection URI from environment
const MONGO_URI = process.env.mongodb || "mongodb://localhost:27017/sabrang";

// User data to insert
const userData = {
  _id: new mongoose.Types.ObjectId('68eb0d46e767b1f32c4a2a58'),
  name: 'Ishaan Raghuvanshi ',
  email: 'ishaanraghuvanshi07@gmail.com',
  password: '$2b$12$gbwo1RM4o7rNlXUFsq6NIODT7BoxGligCYs1VCKGWVgyorNOoDt2G',
  events: [ 'VISITOR_PASS' ],
  qrPath: '68eaa3afaa420883d3c33cbf',
  qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAQ4AAAEOCAAAAABd2qZ5AAACT0lEQVR42u3aO5YCMQwEwLn/pSHdCORRjz9sKQRsNEXS6Ol6qT91IcCBAwcOHDhw4FjMcUXqy9cVz2buG+8ZBw4cOHDgwIEDxz4cN8Ltx7MdhOrNmZ5x4MCBAwcOHDhw7Mgx40Ge+94bZ3HgwIEDBw4cOHD8LEd1xNw5gQMHDhw4cODAgQNHZymhNerFgQMHDhw4cODA8Q84Mq2mo/6R+x04cODAgQMHDhw4Bjk61QnV6UB+o2ccOHDgwIEDBw4ciznSlVlKeE0tHDhw4MCBAwcOHKs5MiG4CpMeHXf6w4EDBw4cOHDgwLEPR2aYO+PdzAkcOHDgwIEDBw4c53GMD4efW4sYH0+Xe8aBAwcOHDhw4MCxmCMzfM3cNw59I5DjwIEDBw4cOHDg2JCj80jpWJ8ZaIcWGnDgwIEDBw4cOHBM5FgVoGfAlG/GgQMHDhw4cODAsQ3H3NcyMbyzjoEDBw4cOHDgwIHjFI7nBredqJ9ZbcCBAwcOHDhw4MBxCkenmfFh8/jnOoUDBw4cOHDgwIFjH450dca61fs6+F9COg4cOHDgwIEDB44lHOnAW201M2LusOHAgQMHDhw4cODYkSMdyDND6UxIx4EDBw4cOHDgwHEex/iyQee+BxcVqpQ4cODAgQMHDhw4fpYjE9fTfw6WhXQcOHDgwIEDBw4ciznGR72ZNYbyLThw4MCBAwcOHDg25OgsNGTWEzLkG+x34MCBAwcOHDhw4BjkeG6JoLPk0PmRyj3jwIEDBw4cOHDgWMyhcODAgQMHDhw4cCyqN4xfEIFeFGnyAAAAAElFTkSuQmCC',
  isvalidated: true,
  hasEntered: false,
  entryTime: null,
  isAdmin: false,
  profileImage: '/uploads/profileImage-1760207790207-889501034.jpg',
  universityIdCard: '',
  contactNo: '9599584312',
  gender: 'male',
  age: 18,
  universityName: "St. Xavier's College ",
  address: '87-A karni nagar near khirni phatak, jhotwara jaipur ',
  referralCode: '',
  userType: 'participant',
  supportRole: '',
  governmentId: '',
  idType: '',
  visitorPassDays: 1,
  teamRegistrations: [],
  registrationHistory: [],
  emailSent: true,
  emailSentAt: new Date('2025-10-11T18:37:39.487Z'),
  emailSentBy: null,
  originalUserId: new mongoose.Types.ObjectId('68eaa3afaa420883d3c33cbf'),
  movedAt: new Date('2025-10-12T02:07:02.349Z'),
  moveReason: 'Payment status not successful',
  createdAt: new Date('2025-10-11T18:36:31.815Z'),
  updatedAt: new Date('2025-10-11T18:36:31.815Z'),
  __v: 0
};

// Function to connect to MongoDB and insert user
async function addUserToDatabase() {
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

    console.log(`User ${userData.name} (${userData.email}) has been successfully added to the database.`);

  } catch (error) {
    console.error("Error adding user to database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the insertion
addUserToDatabase();