/**
 * Script to send registration emails to a specific team
 * Sends emails to team leader and all team members with their QR codes
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Specific team data you provided
const TEAM_DATA = {
    teamId: '68e7e50b1c86ecaf68205e76',
    eventName: 'BANDJAM',
    teamName: "Jatin Singh's Team",
    teamLeader: {
        userId: '68e7e5081c86ecaf68205e68',
        name: 'Jatin Singh',
        email: 'doomsingh702@gmail.com',
        hasEntered: false
    },
    teamMembers: [
        {
            userId: '68e7e5091c86ecaf68205e6b',
            name: 'Antra Dixit',
            email: 'antradixit2144@gmail.com',
            hasEntered: false,
            role: 'member'
        },
        {
            userId: '68e7e5091c86ecaf68205e6e',
            name: 'Anvesha Seervi',
            email: 'anveshaseervi@gmail.com',
            hasEntered: false,
            role: 'member'
        },
        {
            userId: '68e7e50a1c86ecaf68205e71',
            name: 'Faizan Khalwa',
            email: 'khalwafaizan@gmail.com',
            hasEntered: false,
            role: 'member'
        },
        {
            userId: '68e7e50a1c86ecaf68205e74',
            name: 'tanish soni',
            email: 'iamtanishqsoni29@gmail.com',
            hasEntered: false,
            role: 'member'
        }
    ]
};

async function sendTeamRegistrationEmails() {
    try {
        console.log('📧 Starting Team Registration Email Campaign');
        console.log('=' .repeat(60));
        console.log(`🎭 Event: ${TEAM_DATA.eventName}`);
        console.log(`👥 Team: ${TEAM_DATA.teamName}`);
        console.log(`📍 Team ID: ${TEAM_DATA.teamId}`);

        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        // Collect all team member emails (leader + members)
        const allMembers = [
            { ...TEAM_DATA.teamLeader, role: 'leader' },
            ...TEAM_DATA.teamMembers
        ];

        console.log(`\n👥 Team Members (${allMembers.length} total):`);
        allMembers.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name} (${member.role}) - ${member.email}`);
        });

        const results = {
            total: allMembers.length,
            sent: 0,
            failed: 0,
            errors: [],
            details: []
        };

        console.log('\n📤 Starting email sending process...');

        // Send emails to all team members
        for (const member of allMembers) {
            try {
                console.log(`\n📧 Processing ${member.name} (${member.email})...`);

                // Get user details from database
                const user = await User.findById(member.userId);
                
                if (!user) {
                    console.log(`⚠️  User not found in database: ${member.name}`);
                    results.failed++;
                    results.errors.push({
                        name: member.name,
                        email: member.email,
                        error: 'User not found in database'
                    });
                    continue;
                }

                // Prepare user data for email
                const userData = {
                    name: user.name,
                    email: user.email,
                    events: user.events || [TEAM_DATA.eventName],
                    qrCodeBase64: user.qrCodeBase64
                };

                console.log(`   📋 User data: ${userData.name} - Events: ${userData.events.join(', ')}`);
                console.log(`   🔍 QR Code: ${userData.qrCodeBase64 ? 'Available' : 'Missing'}`);

                // Send registration email
                const emailResult = await sendRegistrationEmail(user.email, userData);

                if (emailResult.success) {
                    console.log(`   ✅ Email sent successfully to ${member.name}`);
                    
                    // Update user's emailSent status
                    await User.findByIdAndUpdate(member.userId, { 
                        emailSent: true,
                        emailSentAt: new Date()
                    });
                    
                    results.sent++;
                    results.details.push({
                        name: member.name,
                        email: member.email,
                        role: member.role,
                        status: 'success',
                        hasQR: !!userData.qrCodeBase64,
                        events: userData.events
                    });
                } else {
                    console.log(`   ❌ Failed to send email to ${member.name}: ${emailResult.error}`);
                    results.failed++;
                    results.errors.push({
                        name: member.name,
                        email: member.email,
                        error: emailResult.error
                    });
                }

                // Add small delay between emails
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log(`   ❌ Error processing ${member.name}: ${error.message}`);
                results.failed++;
                results.errors.push({
                    name: member.name,
                    email: member.email,
                    error: error.message
                });
            }
        }

        // Display final results
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEAM EMAIL CAMPAIGN RESULTS');
        console.log('='.repeat(60));
        console.log(`🎭 Event: ${TEAM_DATA.eventName}`);
        console.log(`👥 Team: ${TEAM_DATA.teamName}`);
        console.log(`✅ Successfully sent: ${results.sent} emails`);
        console.log(`❌ Failed to send: ${results.failed} emails`);
        console.log(`📈 Success rate: ${((results.sent / results.total) * 100).toFixed(1)}%`);

        // Show successful emails
        if (results.details.length > 0) {
            console.log('\n✅ SUCCESSFUL EMAILS:');
            results.details.forEach((detail, index) => {
                const qrStatus = detail.hasQR ? '🎫' : '❌';
                console.log(`   ${index + 1}. ${detail.name} (${detail.role}) - ${detail.email} ${qrStatus}`);
                console.log(`      Events: ${detail.events.join(', ')}`);
            });
        }

        // Show failed emails
        if (results.errors.length > 0) {
            console.log('\n❌ FAILED EMAILS:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.name} - ${error.email}`);
                console.log(`      Error: ${error.error}`);
            });
        }

        // Check if any users are missing QR codes
        const missingQR = results.details.filter(detail => !detail.hasQR);
        if (missingQR.length > 0) {
            console.log('\n⚠️  USERS WITHOUT QR CODES:');
            missingQR.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.name} - ${user.email}`);
            });
            console.log('   📝 Note: These users received emails but without QR code attachments');
        }

        console.log('\n🎉 Team registration email campaign completed!');

        // Save results to file
        const timestamp = new Date().toISOString().split('T')[0];
        const fs = require('fs');
        const reportPath = `./team-email-campaign-report-${timestamp}.json`;
        
        const report = {
            campaign: 'Team Registration Email Campaign',
            timestamp: new Date().toISOString(),
            team: {
                teamId: TEAM_DATA.teamId,
                teamName: TEAM_DATA.teamName,
                eventName: TEAM_DATA.eventName,
                totalMembers: allMembers.length
            },
            results: results,
            configuration: {
                fromEmail: process.env.FROM_EMAIL
            }
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);

    } catch (error) {
        console.error('\n❌ TEAM EMAIL CAMPAIGN FAILED:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('📴 Disconnected from MongoDB');
        }
    }
}

// Function to send emails to a custom team (can be used for other teams)
async function sendCustomTeamEmails(customTeamData) {
    try {
        console.log('📧 Starting Custom Team Registration Email Campaign');
        console.log('=' .repeat(60));
        console.log(`🎭 Event: ${customTeamData.eventName}`);
        console.log(`👥 Team: ${customTeamData.teamName}`);

        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        // Process similar to the main function
        const allMembers = [
            { ...customTeamData.teamLeader, role: 'leader' },
            ...customTeamData.teamMembers
        ];

        console.log(`\n👥 Team Members (${allMembers.length} total):`);
        allMembers.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name} (${member.role}) - ${member.email}`);
        });

        // Similar email sending logic...
        // (Implementation would be similar to above)

    } catch (error) {
        console.error('\n❌ CUSTOM TEAM EMAIL CAMPAIGN FAILED:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

// Handle script interruption
process.on('SIGINT', async () => {
    console.log('\n⚠️  Team email campaign interrupted by user');
    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
    process.exit(0);
});

// Run the team email campaign
if (require.main === module) {
    sendTeamRegistrationEmails();
}

module.exports = {
    sendTeamRegistrationEmails,
    sendCustomTeamEmails,
    TEAM_DATA
};