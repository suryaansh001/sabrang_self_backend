const mongoose = require('mongoose');
require('dotenv').config();

const { TeamComposition } = require('./models/models');

async function cleanupVisitorPassTeams() {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('✅ Connected to MongoDB');

        // Find all VISITOR_PASS team compositions
        const visitorPassTeams = await TeamComposition.find({ eventName: 'VISITOR_PASS' });
        console.log(`🔍 Found ${visitorPassTeams.length} VISITOR_PASS team compositions`);

        if (visitorPassTeams.length > 0) {
            // Log the teams before deletion
            console.log('\n📋 VISITOR_PASS teams to be deleted:');
            visitorPassTeams.forEach((team, index) => {
                console.log(`${index + 1}. Team: ${team.teamName}, Leader: ${team.teamLeader.name} (${team.teamLeader.email}), Members: ${team.teamMembers.length}`);
            });

            // Delete all VISITOR_PASS team compositions
            const deleteResult = await TeamComposition.deleteMany({ eventName: 'VISITOR_PASS' });
            console.log(`🗑️ Deleted ${deleteResult.deletedCount} VISITOR_PASS team compositions`);
            console.log('✅ VISITOR_PASS is now properly configured as an individual event only');
        } else {
            console.log('✅ No VISITOR_PASS team compositions found - database is clean');
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupVisitorPassTeams();
