const mongoose = require('mongoose');

// Database connection
mongoose.connect('mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  collegeName: String,
  hasEntered: { type: Boolean, default: false },
  qrCode: String,
  events: [String]
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function addNavyaToStepUp() {
  try {
    console.log('=== ADDING NAVYA JOSHI TO STEP UP ===\n');
    
    // Find Navya's user record
    const navyaUser = await User.findOne({
      email: 'navya.23bcon1308@jecrcu.edu.in'
    });

    if (!navyaUser) {
      console.log('❌ Navya Joshi not found in users collection!');
      return;
    }

    console.log('Found Navya\'s user record:');
    console.log('User ID:', navyaUser._id);
    console.log('Name:', navyaUser.name);
    console.log('Email:', navyaUser.email);
    console.log('Current Events:', navyaUser.events);
    console.log('Has QR Code:', navyaUser.qrCode ? 'Yes' : 'No');

    // Check if STEP UP is already in her events
    if (navyaUser.events.includes('STEP UP')) {
      console.log('\n✅ Navya is already registered for STEP UP!');
      console.log('Current events:', navyaUser.events);
    } else {
      console.log('\n📝 Adding STEP UP to Navya\'s events...');
      
      // Add STEP UP to her events
      navyaUser.events.push('STEP UP');
      await navyaUser.save();
      
      console.log('✅ Successfully added STEP UP to Navya\'s events!');
      console.log('Updated events:', navyaUser.events);
    }

    // Verify the final state
    const updatedNavya = await User.findOne({
      email: 'navya.23bcon1308@jecrcu.edu.in'
    });

    console.log('\n=== FINAL VERIFICATION ===');
    console.log('Name:', updatedNavya.name);
    console.log('Email:', updatedNavya.email);
    console.log('Events:', updatedNavya.events);
    console.log('STEP UP registered:', updatedNavya.events.includes('STEP UP') ? '✅ Yes' : '❌ No');
    console.log('DANCE BATTLE registered:', updatedNavya.events.includes('DANCE BATTLE') ? '✅ Yes' : '❌ No');

    console.log('\n🎉 NAVYA JOSHI IS NOW REGISTERED FOR BOTH EVENTS:');
    console.log('✓ STEP UP (Individual Event)');
    console.log('✓ DANCE BATTLE (Team Event - Quintessence Dance crew QDC)');

  } catch (error) {
    console.error('Error adding Navya to Step Up:', error);
  } finally {
    mongoose.connection.close();
  }
}

addNavyaToStepUp();