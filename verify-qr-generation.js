const { User } = require('./models/models');
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyQRGeneration() {
  try {
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');

    // Check users that now have QR codes
    const usersWithQR = await User.find({
      $and: [
        { qrPath: { $exists: true, $ne: null, $ne: '' } },
        { qrCodeBase64: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).select('name email qrPath').sort({ name: 1 });

    console.log(`\n🎯 Users with QR codes: ${usersWithQR.length}`);

    // Check users still without QR codes
    const usersWithoutQR = await User.find({
      $or: [
        { qrPath: { $exists: false } },
        { qrPath: null },
        { qrPath: '' },
        { qrCodeBase64: { $exists: false } },
        { qrCodeBase64: null },
        { qrCodeBase64: '' }
      ]
    }).select('name email userType').sort({ name: 1 });

    console.log(`❌ Users still without QR codes: ${usersWithoutQR.length}`);
    
    if (usersWithoutQR.length > 0) {
      console.log('\nUsers still missing QR codes:');
      usersWithoutQR.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - Type: ${user.userType || 'unknown'}`);
      });
    }

    console.log('\n✅ QR Generation verification complete!');

  } catch (error) {
    console.error('❌ Error verifying QR generation:', error);
  } finally {
    await mongoose.connection.close();
  }
}

verifyQRGeneration();