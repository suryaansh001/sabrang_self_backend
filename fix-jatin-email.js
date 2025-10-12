/**
 * Script to fix Jatin Singh's email address in the database
 * Changes from "doomsingh702@gmai.com" to "doomsingh702@gmail.com"
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
require('dotenv').config();

async function fixJatinEmail() {
    try {
        console.log('🔧 Fixing Jatin Singh\'s email address...');
        
        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        const jatinUserId = '68e7e5081c86ecaf68205e68';
        const oldEmail = 'doomsingh702@gmai.com';
        const newEmail = 'doomsingh702@gmail.com';

        // Find the user first
        const user = await User.findById(jatinUserId);
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('\n📋 Current User Details:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Current Email: "${user.email}"`);
        console.log(`   User ID: ${user._id}`);

        if (user.email !== oldEmail) {
            console.log('⚠️  Email doesn\'t match expected old email. Aborting...');
            return;
        }

        // Update the email
        console.log('\n🔄 Updating email address...');
        const result = await User.findByIdAndUpdate(
            jatinUserId,
            { 
                email: newEmail,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (result) {
            console.log('✅ Email updated successfully!');
            console.log('\n📋 Updated User Details:');
            console.log(`   Name: ${result.name}`);
            console.log(`   New Email: "${result.email}"`);
            console.log(`   Updated At: ${result.updatedAt}`);
            
            // Verify the change
            const verifyUser = await User.findById(jatinUserId);
            if (verifyUser.email === newEmail) {
                console.log('✅ Verification successful - email correctly updated in database');
            } else {
                console.log('❌ Verification failed - email not updated properly');
            }
        } else {
            console.log('❌ Failed to update email');
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

// Run the fix
if (require.main === module) {
    fixJatinEmail();
}

module.exports = { fixJatinEmail };