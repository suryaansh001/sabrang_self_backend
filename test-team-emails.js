require('dotenv').config();
const { sendTeamRegistrationEmails } = require('./utils/emailService');

/**
 * Test script to verify team registration emails functionality
 */
async function testTeamEmails() {
    console.log('🧪 Testing team registration emails...');
    
    // Sample team data
    const teamData = {
        mainPerson: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            events: ['Dance Competition', 'Coding Contest']
        },
        teamMembers: [
            {
                name: 'Jane Smith',
                email: 'jane.smith@example.com',
                events: ['Dance Competition', 'Coding Contest']
            },
            {
                name: 'Bob Wilson',
                email: 'bob.wilson@example.com',
                events: ['Dance Competition', 'Coding Contest']
            }
        ]
    };
    
    console.log('📊 Test team data:', {
        leader: teamData.mainPerson.name,
        memberCount: teamData.teamMembers.length,
        memberNames: teamData.teamMembers.map(m => m.name)
    });
    
    try {
        const result = await sendTeamRegistrationEmails(teamData);
        
        console.log('\n📧 Email sending results:');
        console.log(`✅ Success: ${result.success}`);
        console.log(`📊 Summary: ${result.summary?.successful}/${result.summary?.total} emails sent`);
        
        if (result.results && result.results.length > 0) {
            console.log('\n📋 Detailed results:');
            result.results.forEach((r, index) => {
                const status = r.success ? '✅' : '❌';
                console.log(`${status} ${index + 1}. ${r.name} (${r.email}) - ${r.role}`);
                if (!r.success) {
                    console.log(`   Error: ${r.error}`);
                }
            });
        }
        
        if (result.success) {
            console.log('\n🎉 Team email test completed successfully!');
        } else {
            console.log('\n❌ Team email test failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testTeamEmails()
        .then(() => {
            console.log('\n🔚 Test completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test failed with error:', error);
            process.exit(1);
        });
}

module.exports = { testTeamEmails };
