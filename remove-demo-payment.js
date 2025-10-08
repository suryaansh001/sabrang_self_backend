/**
 * Script to remove "Demo Payment" from all users' events array
 * 
 * This script will:
 * 1. Find all users who have "Demo Payment" in their events array
 * 2. Remove "Demo Payment" from their events array
 * 3. Update the users in the database
 * 4. Provide detailed statistics of the operation
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');

// Statistics tracking
let stats = {
    totalUsers: 0,
    usersWithDemoPayment: 0,
    usersUpdated: 0,
    errors: 0,
    errorDetails: []
};

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.mongodb, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

async function findUsersWithDemoPayment() {
    try {
        console.log('\n🔍 Finding users with "Demo Payment" in events array...');
        
        // Find users who have "Demo Payment" in their events array
        const usersWithDemoPayment = await User.find({
            events: { $in: ['Demo Payment'] }
        }).select('_id name email events');

        stats.totalUsers = await User.countDocuments();
        stats.usersWithDemoPayment = usersWithDemoPayment.length;

        console.log(`📊 Total users in database: ${stats.totalUsers}`);
        console.log(`🎯 Users with "Demo Payment": ${stats.usersWithDemoPayment}`);

        if (usersWithDemoPayment.length > 0) {
            console.log('\n📋 First 10 users with Demo Payment:');
            usersWithDemoPayment.slice(0, 10).forEach((user, index) => {
                console.log(`${index + 1}. ${user.name} (${user.email})`);
                console.log(`   Events: ${user.events.join(', ')}`);
            });
            
            if (usersWithDemoPayment.length > 10) {
                console.log(`... and ${usersWithDemoPayment.length - 10} more users`);
            }
        }

        return usersWithDemoPayment;
    } catch (error) {
        console.error('❌ Error finding users:', error);
        throw error;
    }
}

async function removeDemoPaymentFromUser(user, index, total) {
    try {
        console.log(`\n[${index + 1}/${total}] Processing: ${user.name} (${user.email})`);
        console.log(`   Current events: ${user.events.join(', ')}`);
        
        // Remove "Demo Payment" from events array
        const originalEventsCount = user.events.length;
        const updatedEvents = user.events.filter(event => event !== 'Demo Payment');
        
        if (updatedEvents.length === originalEventsCount) {
            console.log(`   ⚠️ No "Demo Payment" found in events array`);
            return false;
        }
        
        // Update user in database
        await User.findByIdAndUpdate(user._id, {
            events: updatedEvents,
            updatedAt: new Date()
        });
        
        console.log(`   ✅ Updated events: ${updatedEvents.join(', ')}`);
        console.log(`   📊 Events count: ${originalEventsCount} → ${updatedEvents.length}`);
        stats.usersUpdated++;
        return true;
        
    } catch (error) {
        console.error(`❌ Error processing user ${user.name} (${user.email}):`, error.message);
        stats.errors++;
        stats.errorDetails.push({
            user: `${user.name} (${user.email})`,
            error: error.message
        });
        return false;
    }
}

async function removeDemoPaymentFromAllUsers() {
    try {
        console.log('🎯 REMOVE DEMO PAYMENT SCRIPT');
        console.log('=============================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        console.log(`🎯 Target: Remove "Demo Payment" from all users' events arrays\n`);

        // Connect to database
        await connectToDatabase();

        // Find users with Demo Payment
        const usersWithDemoPayment = await findUsersWithDemoPayment();

        if (usersWithDemoPayment.length === 0) {
            console.log('\n🎉 No users found with "Demo Payment" in their events. Nothing to do.');
            return;
        }

        // Ask for confirmation (in a real scenario, you might want user input)
        console.log('\n⚠️ WARNING: This will remove "Demo Payment" from all users\' events arrays.');
        console.log('This action cannot be undone easily.');
        console.log(`📊 ${usersWithDemoPayment.length} users will be affected.`);
        
        // In automated mode, we'll proceed. In interactive mode, you'd wait for confirmation.
        console.log('\n🚀 Proceeding with removal...');
        console.log('='.repeat(60));

        // Process each user
        for (let i = 0; i < usersWithDemoPayment.length; i++) {
            const user = usersWithDemoPayment[i];
            await removeDemoPaymentFromUser(user, i, usersWithDemoPayment.length);
            
            // Add a small delay to prevent overwhelming the database
            if (i < usersWithDemoPayment.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
        }

        // Final summary
        console.log('\n🎉 DEMO PAYMENT REMOVAL COMPLETED');
        console.log('='.repeat(60));
        console.log(`📊 Processing Summary:`);
        console.log(`   👥 Total users in database: ${stats.totalUsers}`);
        console.log(`   🎯 Users with "Demo Payment" found: ${stats.usersWithDemoPayment}`);
        console.log(`   ✅ Users successfully updated: ${stats.usersUpdated}`);
        console.log(`   ❌ Errors encountered: ${stats.errors}`);

        // Error details
        if (stats.errorDetails.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            console.log('-'.repeat(60));
            stats.errorDetails.forEach((error, index) => {
                console.log(`${index + 1}. ${error.user}: ${error.error}`);
            });
        }

        const successRate = stats.usersWithDemoPayment > 0 ? 
            ((stats.usersUpdated / stats.usersWithDemoPayment) * 100).toFixed(1) : 0;
        
        console.log(`\n📈 Success Rate: ${successRate}%`);
        console.log(`📅 Completed at: ${new Date().toLocaleString()}`);
        
        if (stats.usersUpdated > 0) {
            console.log('\n🏆 Demo Payment removal completed successfully!');
            console.log('💡 Recommendations:');
            console.log('   1. Run a new CSV export to verify the changes');
            console.log('   2. Check that users still have valid events in their arrays');
            console.log('   3. Consider running a data validation script');
        }

        // Verification - count remaining users with Demo Payment
        console.log('\n🔍 VERIFICATION:');
        const remainingUsers = await User.countDocuments({
            events: { $in: ['Demo Payment'] }
        });
        console.log(`📊 Users still with "Demo Payment": ${remainingUsers}`);
        
        if (remainingUsers === 0) {
            console.log('✅ All "Demo Payment" entries have been successfully removed!');
        } else {
            console.log(`⚠️ ${remainingUsers} users still have "Demo Payment" - may need manual review`);
        }

    } catch (error) {
        console.error('💥 Script execution failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        try {
            await mongoose.connection.close();
            console.log('\n🔌 Database connection closed');
        } catch (disconnectError) {
            console.error('❌ Error closing database connection:', disconnectError);
        }
        process.exit(0);
    }
}

// Load environment variables
require('dotenv').config();

// Validate environment variables
if (!process.env.mongodb) {
    console.error('❌ Error: mongodb environment variable not found');
    process.exit(1);
}

// Run the script
removeDemoPaymentFromAllUsers();