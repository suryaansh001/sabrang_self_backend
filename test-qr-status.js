const mongoose = require('mongoose');
require('dotenv').config();

async function testQRCodeData() {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('Connected to database');

        const { User, TeamComposition } = require('./models/models');

        // Find a team composition
        const team = await TeamComposition.findOne({}).populate('teamMembers.userId');
        if (!team) {
            console.log('No team compositions found');
            return;
        }

        console.log(`Found team: ${team.eventName} with ${team.teamMembers.length} members`);

        // Check team leader QR
        const teamLeader = await User.findById(team.teamLeader.userId);
        console.log(`Team leader ${teamLeader?.name} QR: ${teamLeader?.qrCodeBase64 ? 'Present (' + teamLeader.qrCodeBase64.substring(0, 20) + '...)' : 'Missing'}`);

        // Check team members QR
        for (const member of team.teamMembers) {
            const memberUser = await User.findById(member.userId);
            console.log(`Member ${member.name} QR: ${memberUser?.qrCodeBase64 ? 'Present (' + memberUser.qrCodeBase64.substring(0, 20) + '...)' : 'Missing'}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}

testQRCodeData();
