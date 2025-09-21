const mongoose = require('mongoose');
require('dotenv').config();

const { User, TeamComposition } = require('./models/models');

async function testFlagshipBenefits() {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('✅ Connected to MongoDB');

        // Check users with flagship visitor userType
        const flagshipVisitors = await User.find({ 
            userType: { $in: ['flagship_visitor', 'flagship_solo_visitor'] } 
        }).select('name email userType events');
        
        console.log(`\n🎯 Found ${flagshipVisitors.length} flagship visitors:`);
        flagshipVisitors.forEach((visitor, index) => {
            console.log(`${index + 1}. ${visitor.name} (${visitor.email}) - Type: ${visitor.userType}, Events: ${visitor.events.join(', ')}`);
        });

        // Check support staff with flagship events
        const supportStaff = await User.find({ 
            userType: 'support_staff',
            events: { $in: ['RAMPWALK - PANACHE', 'DANCE BATTLE', 'BANDJAM'] }
        }).select('name email supportRole events');
        
        console.log(`\n🎨 Found ${supportStaff.length} support staff in flagship events:`);
        supportStaff.forEach((staff, index) => {
            console.log(`${index + 1}. ${staff.name} (${staff.email}) - Role: ${staff.supportRole}, Events: ${staff.events.join(', ')}`);
        });

        // Check team compositions that include flagship visitors or support staff
        const teamCompositions = await TeamComposition.find({
            eventName: { $in: ['RAMPWALK - PANACHE', 'DANCE BATTLE', 'BANDJAM'] }
        }).select('eventName teamName teamMembers totalMembers');

        console.log(`\n🏆 Found ${teamCompositions.length} team compositions for flagship events:`);
        teamCompositions.forEach((team, index) => {
            console.log(`${index + 1}. Event: ${team.eventName}, Team: ${team.teamName}, Members: ${team.totalMembers}`);
            team.teamMembers.forEach((member, memberIndex) => {
                console.log(`   ${memberIndex + 1}. ${member.name} (${member.email}) - Role: ${member.role}`);
            });
        });

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error during test:', error);
        process.exit(1);
    }
}

// Run the test
testFlagshipBenefits();
