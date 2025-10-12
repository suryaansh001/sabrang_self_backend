/**
 * Quick script to check Jatin Singh's email in the database
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
require('dotenv').config();

async function checkJatinEmail() {
    try {
        console.log('🔍 Checking Jatin Singh\'s email in database...');
        
        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        // Find Jatin Singh by userId
        const jatinUserId = '68e7e5081c86ecaf68205e68';
        const user = await User.findById(jatinUserId);
        
        if (user) {
            console.log('\n📋 User Details:');
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: "${user.email}"`);
            console.log(`   User ID: ${user._id}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log(`   Updated: ${user.updatedAt}`);
            
            // Check if email has any hidden characters
            const emailBytes = Buffer.from(user.email, 'utf8');
            console.log(`   Email bytes: ${emailBytes.toString('hex')}`);
            console.log(`   Email length: ${user.email.length}`);
            
            // Check for common typos
            if (user.email.includes('gmai.com')) {
                console.log('   ⚠️  FOUND TYPO: Email contains "gmai.com" instead of "gmail.com"');
            } else {
                console.log('   ✅ Email looks correct');
            }
        } else {
            console.log('❌ User not found with ID:', jatinUserId);
        }

        // Also search by name to see if there are multiple Jatin Singh entries
        console.log('\n🔍 Searching for all users named "Jatin Singh"...');
        const jatinUsers = await User.find({ name: /jatin singh/i });
        
        if (jatinUsers.length > 0) {
            console.log(`   Found ${jatinUsers.length} user(s) with name containing "Jatin Singh":`);
            jatinUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. Name: "${user.name}", Email: "${user.email}", ID: ${user._id}`);
            });
        } else {
            console.log('   No users found with name "Jatin Singh"');
        }

        // Search by partial email to see if there are variations
        console.log('\n🔍 Searching for emails containing "doomsingh702"...');
        const emailUsers = await User.find({ email: /doomsingh702/i });
        
        if (emailUsers.length > 0) {
            console.log(`   Found ${emailUsers.length} user(s) with email containing "doomsingh702":`);
            emailUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. Name: "${user.name}", Email: "${user.email}", ID: ${user._id}`);
            });
        } else {
            console.log('   No users found with email containing "doomsingh702"');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('📴 Disconnected from MongoDB');
        }
    }
}

// Run the check
if (require.main === module) {
    checkJatinEmail();
}

module.exports = { checkJatinEmail };