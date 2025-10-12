const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  contactNo: String,
  events: [String],
  qrCodeBase64: String
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const main = async () => {
  try {
    await connectDB();
    const nagendra = await User.findOne({ email: 'ms1221254@mse.iitd.ac.in' });
    if (nagendra) {
      console.log('Nagendra found:', {
        id: nagendra._id,
        name: nagendra.name,
        email: nagendra.email,
        phone: nagendra.contactNo,
        hasQR: !!nagendra.qrCodeBase64,
        events: nagendra.events
      });
    } else {
      console.log('Nagendra not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

main();