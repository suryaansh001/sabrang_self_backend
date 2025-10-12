const mongoose = require('mongoose');
const csv = require('csv-parser');
const fs = require('fs');
const { User, TeamComposition } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// MongoDB connection
const connectDB = async () => {
    try {
        const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl;
        await mongoose.connect(mongoUri);
        console.log('📊 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Function to parse CSV and extract team data
const parseBGMITeamsFromCSV = async (csvPath) => {
    return new Promise((resolve, reject) => {
        const teams = [];

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                // Skip empty rows or header rows
                if (!row['Squad Name'] || row['Squad Name'] === 'Squad Name') {
                    return;
                }

                const team = {
                    teamName: row['Squad Name']?.trim(),
                    teamLeader: {
                        name: row['Team Leader Name']?.trim(),
                        email: row['Team Leader Email']?.trim(),
                        contactNo: row['Leader Mobile Number']?.trim(),
                        gender: row['Gender']?.trim(),
                        age: parseInt(row['Age']?.trim()) || null,
                        universityName: row['Institution Name']?.trim(),
                        address: row['Address']?.trim()
                    },
                    teamMembers: []
                };

                // Add member 2
                if (row['Member 2 Name']?.trim()) {
                    team.teamMembers.push({
                        name: row['Member 2 Name']?.trim(),
                        email: row['Member 2 Email']?.trim(),
                        contactNo: row['Member 2 Phone Number']?.trim(),
                        gender: row['Gender']?.trim(),
                        age: parseInt(row['Age']?.trim()) || null,
                        universityName: row['Institution Name']?.trim(),
                        address: row['Address']?.trim(),
                        role: 'member'
                    });
                }

                // Add member 3
                if (row['Member 3 Name']?.trim()) {
                    team.teamMembers.push({
                        name: row['Member 3 Name']?.trim(),
                        email: row['Member 3 Email']?.trim(),
                        contactNo: row['Member 3 Phone Number']?.trim(),
                        gender: row['Age']?.trim(),
                        age: parseInt(row['Institution Name']?.trim()) || null,
                        universityName: row['Institution Identity Card']?.trim(),
                        address: row['Address']?.trim(),
                        role: 'member'
                    });
                }

                // Add member 4
                if (row['Member 4 Name']?.trim()) {
                    team.teamMembers.push({
                        name: row['Member 4 Name']?.trim(),
                        email: row['Member 4 Email']?.trim(),
                        contactNo: row['Member 4 Phone Number']?.trim(),
                        gender: row['Age ']?.trim(),
                        age: parseInt(row['Institution Name']?.trim()) || null,
                        universityName: row['Institution Identity Card']?.trim(),
                        address: row['Address']?.trim(),
                        role: 'member'
                    });
                }

                // Add substitute member if exists
                if (row['Substitute Member Name']?.trim()) {
                    team.teamMembers.push({
                        name: row['Substitute Member Name']?.trim(),
                        email: row['Substitute Member Email']?.trim(),
                        contactNo: row['Substitute Member Phone Number']?.trim(),
                        gender: row['Column 44']?.trim(),
                        age: parseInt(row['Age']?.trim()) || null,
                        universityName: row['Institution Name']?.trim(),
                        address: row['Address']?.trim(),
                        role: 'substitute'
                    });
                }

                // Only add teams with valid data
                if (team.teamName && team.teamLeader.name && team.teamLeader.email && team.teamMembers.length > 0) {
                    teams.push(team);
                }
            })
            .on('end', () => {
                console.log(`📄 Parsed ${teams.length} teams from CSV`);
                resolve(teams);
            })
            .on('error', reject);
    });
};

// Function to create or update a user
const createOrUpdateUser = async (userData) => {
    try {
        console.log(`\n🔍 Processing user: ${userData.name} (${userData.email})`);

        // Check if user already exists
        let user = await User.findOne({ email: userData.email });
        let isNewUser = false;

        if (user) {
            console.log(`   ✅ User already exists: ${user.name}`);

            // Add BGMI TOURNAMENT to events if not already present
            if (!user.events.includes('BGMI TOURNAMENT')) {
                user.events.push('BGMI TOURNAMENT');
                console.log(`   ✅ Added BGMI TOURNAMENT to user's events`);
            }

            // Update user details if provided
            if (userData.contactNo && userData.contactNo !== user.contactNo) {
                user.contactNo = userData.contactNo;
                console.log(`   ✅ Updated contact number`);
            }
            if (userData.universityName && userData.universityName !== user.universityName) {
                user.universityName = userData.universityName;
                console.log(`   ✅ Updated university name`);
            }
            if (userData.address && userData.address !== user.address) {
                user.address = userData.address;
                console.log(`   ✅ Updated address`);
            }

        } else {
            // Create new user
            console.log(`   🆕 Creating new user: ${userData.name}`);
            isNewUser = true;
            user = new User({
                name: userData.name,
                email: userData.email,
                contactNo: userData.contactNo || '',
                gender: userData.gender || '',
                age: userData.age || null,
                universityName: userData.universityName || '',
                address: userData.address || '',
                events: ['BGMI TOURNAMENT'],
                isvalidated: true,
                hasEntered: false,
                userType: 'participant',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Set validation to true
        user.isvalidated = true;
        user.updatedAt = new Date();
        await user.save();

        if (isNewUser) {
            console.log(`   ✅ User created successfully: ${user._id}`);
        } else {
            console.log(`   ✅ User updated successfully: ${user._id}`);
        }

        return { user, isNewUser };

    } catch (error) {
        console.error(`   ❌ Error processing user ${userData.name}:`, error);
        throw error;
    }
};

// Function to generate QR code for user
const generateQRForUser = async (user) => {
    try {
        if (user.qrCodeBase64) {
            console.log(`   📱 QR code already exists for ${user.name}`);
            return true;
        }

        console.log(`   📱 Generating QR code for ${user.name}...`);

        const qrCodeBase64 = await generateUserQRCode(user._id, {
            name: user.name,
            email: user.email,
            events: user.events,
            userId: user._id
        });

        if (qrCodeBase64) {
            user.qrPath = `qr_${user._id}.png`;
            user.qrCodeBase64 = qrCodeBase64;
            user.updatedAt = new Date();
            await user.save();
            console.log(`   ✅ QR code generated successfully`);
            return true;
        } else {
            console.log(`   ❌ QR code generation failed`);
            return false;
        }

    } catch (error) {
        console.error(`   ❌ Error generating QR for ${user.name}:`, error);
        return false;
    }
};

// Function to send registration email
const sendEmailToUser = async (user) => {
    try {
        if (user.emailSent) {
            console.log(`   📧 Email already sent to ${user.name}`);
            return true;
        }

        if (!user.qrCodeBase64) {
            console.log(`   ❌ Cannot send email - QR code missing for ${user.name}`);
            return false;
        }

        console.log(`   📧 Sending registration email to ${user.name}...`);

        const emailData = {
            name: user.name,
            events: user.events,
            qrCodeBase64: user.qrCodeBase64
        };

        const emailResult = await sendRegistrationEmail(user.email, emailData);

        if (emailResult.success) {
            user.emailSent = true;
            user.emailSentAt = new Date();
            user.updatedAt = new Date();
            await user.save();
            console.log(`   ✅ Registration email sent successfully`);
            return true;
        } else {
            console.log(`   ❌ Email sending failed: ${emailResult.error}`);
            return false;
        }

    } catch (error) {
        console.error(`   ❌ Error sending email to ${user.name}:`, error);
        return false;
    }
};

// Function to create or update BGMI team
const createOrUpdateBGMITeam = async (teamData) => {
    try {
        console.log(`\n🏆 Processing BGMI TOURNAMENT team: ${teamData.teamName}`);

        let team;
        let isNewTeam = false;

        // Check if team already exists by team name and event
        team = await TeamComposition.findOne({
            eventName: 'BGMI TOURNAMENT',
            teamName: teamData.teamName
        });

        if (team) {
            console.log(`   ✅ Team already exists: ${team.teamName} (ID: ${team._id})`);
        } else {
            console.log(`   🆕 Creating new team: ${teamData.teamName}`);
            isNewTeam = true;
        }

        // Process team leader
        console.log(`\n👑 Processing Team Leader:`);
        const { user: teamLeader } = await createOrUpdateUser(teamData.teamLeader);

        // Process team members
        console.log(`\n👥 Processing Team Members:`);
        const processedMembers = [];
        for (const memberData of teamData.teamMembers) {
            const { user: member } = await createOrUpdateUser(memberData);
            processedMembers.push({
                userId: member._id,
                name: member.name,
                email: member.email,
                hasEntered: false,
                role: memberData.role || 'member'
            });
        }

        if (isNewTeam) {
            // Create new team
            team = new TeamComposition({
                eventName: 'BGMI TOURNAMENT',
                teamName: teamData.teamName,
                teamLeader: {
                    userId: teamLeader._id,
                    name: teamLeader.name,
                    email: teamLeader.email,
                    hasEntered: false
                },
                teamMembers: processedMembers,
                totalMembers: processedMembers.length + 1,
                maxTeamSize: 4,
                registrationComplete: true,
                teamEntryStatus: {
                    totalEntered: 0,
                    pendingEntry: processedMembers.length + 1,
                    allEntered: false
                },
                paymentStatus: teamData.paymentStatus || 'completed',
                purchaseId: teamData.purchaseId || null,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await team.save();
            console.log(`\n✅ Team created successfully: ${team._id}`);
        } else {
            // Update existing team
            team.teamLeader = {
                userId: teamLeader._id,
                name: teamLeader.name,
                email: teamLeader.email,
                hasEntered: team.teamLeader.hasEntered || false
            };
            team.teamMembers = processedMembers;
            team.totalMembers = processedMembers.length + 1;
            team.updatedAt = new Date();

            await team.save();
            console.log(`\n✅ Team updated successfully: ${team._id}`);
        }

        // Update team registrations for all members
        console.log(`\n🔄 Updating team registrations...`);

        // Update team leader's team registrations
        const existingLeaderReg = teamLeader.teamRegistrations.find(
            reg => reg.teamCompositionId?.equals(team._id)
        );

        if (!existingLeaderReg) {
            teamLeader.teamRegistrations.push({
                eventName: 'BGMI TOURNAMENT',
                teamLeaderId: teamLeader._id,
                isTeamLeader: true,
                teamName: teamData.teamName,
                teamCompositionId: team._id,
                registeredAt: new Date()
            });
            await teamLeader.save();
            console.log(`   ✅ Added team registration for leader: ${teamLeader.name}`);
        }

        // Update team members' team registrations
        for (const memberInfo of processedMembers) {
            const member = await User.findById(memberInfo.userId);
            const existingMemberReg = member.teamRegistrations.find(
                reg => reg.teamCompositionId?.equals(team._id)
            );

            if (!existingMemberReg) {
                member.teamRegistrations.push({
                    eventName: 'BGMI TOURNAMENT',
                    teamLeaderId: teamLeader._id,
                    isTeamLeader: false,
                    teamName: teamData.teamName,
                    teamCompositionId: team._id,
                    registeredAt: new Date()
                });
                await member.save();
                console.log(`   ✅ Added team registration for member: ${member.name}`);
            }
        }

        return { team, teamLeader, members: processedMembers };

    } catch (error) {
        console.error('❌ Error creating/updating BGMI team:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();

        console.log('🎯 BGMI TOURNAMENT CSV Team Import Script');
        console.log('=' .repeat(60));

        // Parse teams from CSV
        const csvPath = './bgmi.csv';
        const teams = await parseBGMITeamsFromCSV(csvPath);

        console.log(`\n📋 Found ${teams.length} teams in CSV:`);
        teams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.teamName} - ${team.teamMembers.length} members`);
        });

        // Check if this is a dry run
        const args = process.argv.slice(2);
        const isDryRun = !args.includes('--execute');

        if (isDryRun) {
            console.log('\n🔍 DRY RUN MODE - No changes will be made');
            console.log('\n📋 Sample team data:');
            if (teams.length > 0) {
                const sampleTeam = teams[0];
                console.log(`   Team Name: ${sampleTeam.teamName}`);
                console.log(`   Leader: ${sampleTeam.teamLeader.name} (${sampleTeam.teamLeader.email})`);
                console.log(`   Members: ${sampleTeam.teamMembers.length}`);
                sampleTeam.teamMembers.forEach((member, index) => {
                    console.log(`     ${index + 1}. ${member.name} (${member.email})`);
                });
            }
            console.log('\n⚠️  Actions that will be performed:');
            console.log('   - Create/update users in database');
            console.log('   - Add BGMI TOURNAMENT to user events');
            console.log('   - Create/update team compositions');
            console.log('   - Update team registrations for all members');
            console.log('   - Generate QR codes for all users');
            console.log('   - Send registration emails to all users');
            console.log('\n🚀 Use --execute flag to process all teams: node bgmi-csv-import.js --execute');
            return;
        }

        // Process all teams
        let totalTeamsProcessed = 0;
        let totalUsersCreated = 0;
        let totalUsersUpdated = 0;
        let totalQRCodesGenerated = 0;
        let totalEmailsSent = 0;

        for (const teamData of teams) {
            try {
                console.log(`\n🎯 Processing team ${totalTeamsProcessed + 1}/${teams.length}: ${teamData.teamName}`);

                // Create or update the team
                const { team, teamLeader, members } = await createOrUpdateBGMITeam(teamData);

                // Generate QR codes for all users
                console.log('\n📱 Generating QR codes...');
                const allUsers = [teamLeader];
                for (const memberInfo of members) {
                    const member = await User.findById(memberInfo.userId);
                    allUsers.push(member);
                }

                let qrSuccess = 0;
                for (const user of allUsers) {
                    if (await generateQRForUser(user)) {
                        qrSuccess++;
                    }
                }

                // Send emails to all users
                console.log('\n📧 Sending registration emails...');
                let emailSuccess = 0;
                for (const user of allUsers) {
                    if (await sendEmailToUser(user)) {
                        emailSuccess++;
                    }
                }

                totalTeamsProcessed++;
                totalQRCodesGenerated += qrSuccess;
                totalEmailsSent += emailSuccess;

                console.log(`\n✅ Team ${teamData.teamName} completed: ${qrSuccess} QR codes, ${emailSuccess} emails sent`);

            } catch (error) {
                console.error(`❌ Error processing team ${teamData.teamName}:`, error);
            }
        }

        console.log('\n🎉 BGMI CSV IMPORT COMPLETED');
        console.log('=' .repeat(60));
        console.log('📊 Final Summary:');
        console.log(`   ✅ Teams processed: ${totalTeamsProcessed}`);
        console.log(`   ✅ QR codes generated: ${totalQRCodesGenerated}`);
        console.log(`   ✅ Emails sent: ${totalEmailsSent}`);
        console.log(`   ✅ All users validated and registered`);

    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        console.log('\n📴 Disconnecting from MongoDB');
        await mongoose.disconnect();
        process.exit(0);
    }
};

// Run the script
main().catch(console.error);