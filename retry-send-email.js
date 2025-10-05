const mongoose = require('mongoose');
const { User } = require('./models/models');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

const TARGET_EMAIL = 'vijaypratp7475@gmail.com';

async function retrySendEmail() {
  try {
    await mongoose.connect(process.env.mongodb);
    console.log('📧 Retry sending email to Harsh Chandeliya...\n');

    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log('👤 USER INFO:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Events: [${user.events.join(', ')}]`);
    console.log(`   QR Code: ${user.qrCodeBase64 ? 'Present' : 'Missing'}`);
    console.log('');

    const emailData = {
      name: user.name,
      events: user.events,
      qrCodeBase64: user.qrCodeBase64
    };

    console.log('📤 Sending email with corrected event information...');
    const emailResult = await sendRegistrationEmail(user.email, emailData);

    if (emailResult.success) {
      console.log('✅ Email sent successfully!');
      
      // Update email tracking
      user.emailSent = true;
      user.emailSentAt = new Date();
      await user.save();
      
      console.log('📝 Updated email tracking in user record');
    } else {
      console.log('❌ Email failed:', emailResult.error);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

retrySendEmail();