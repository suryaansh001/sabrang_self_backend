// Clean up test data and create fresh team data
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.mongodb);

const { User, TeamComposition } = require('./models/models');

async function cleanAndCreateTestData() {
    try {
        console.log('🧹 Cleaning up old test data...\n');

        // Clean up any existing test data
        await User.deleteMany({ 
            email: { 
                $in: [
                    'testleader@example.com',
                    'teammember1@example.com', 
                    'teammember2@example.com', 
                    'teammember3@example.com'
                ] 
            } 
        });
        await TeamComposition.deleteMany({ 
            eventName: 'BGMI',
            'teamLeader.email': 'testleader@example.com'
        });
        
        console.log('✅ Cleaned up old test data');

        console.log('🧪 Creating fresh test team data...\n');

        // Create team leader
        const teamLeader = new User({
            name: 'Test Team Leader',
            email: 'testleader@example.com',
            college: 'Test University',
            studentId: 'TL2024001',
            phoneNumber: '+919999999990',
            events: ['BGMI'],
            userType: 'participant',
            qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        });
        await teamLeader.save();
        console.log('✅ Created team leader:', teamLeader.email);

        // Create team members
        const teamMembers = [];
        for (let i = 1; i <= 3; i++) {
            const member = new User({
                name: `Test Team Member ${i}`,
                email: `teammember${i}@example.com`,
                college: 'Test University',
                studentId: `TM2024${i.toString().padStart(3, '0')}`,
                phoneNumber: `+91999999999${i}`,
                events: ['BGMI'],
                userType: 'participant',
                qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            });
            await member.save();
            teamMembers.push(member);
            console.log(`✅ Created team member ${i}:`, member.email);
        }

        // Create team composition
        const teamComposition = new TeamComposition({
            teamName: 'Test BGMI Team',
            teamLeader: {
                userId: teamLeader._id,
                name: teamLeader.name,
                email: teamLeader.email,
                hasEntered: false
            },
            teamMembers: teamMembers.map(member => ({
                userId: member._id,
                name: member.name,
                email: member.email,
                hasEntered: false
            })),
            eventName: 'BGMI',
            eventId: 'bgmi-test',
            totalMembers: 4,
            paymentStatus: 'completed',
            teamEntryStatus: 'not_entered'
        });
        await teamComposition.save();
        console.log('✅ Created team composition:', teamComposition._id);

        console.log('\n🎯 Test data created successfully!');
        console.log(`📧 Use email: ${teamLeader.email} to test the ticket page`);
        console.log('🔍 You should see:');
        console.log('   - 1 Team Leader registration');
        console.log('   - 3 Team Members with QR codes');
        console.log('   - All QR codes should display properly');

    } catch (error) {
        console.error('❌ Error creating test data:', error);
    } finally {
        mongoose.disconnect();
    }
}

cleanAndCreateTestData();
