const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');
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
        
        console.log('🎯 BGMI TOURNAMENT Team Management Script');
        console.log('=' .repeat(60));
        
        // Team data - UPDATE THIS WITH ACTUAL TEAM INFORMATION
        const teamData = {
            teamName: 'Alpha Warriors',
            teamLeader: {
                name: 'Arjun Patel',
                email: 'arjun.alpha@gmail.com',
                contactNo: '9123456789',
                gender: 'Male',
                age: 21,
                universityName: 'JK Lakshmipat University',
                address: 'Jaipur, Rajasthan'
            },
            teamMembers: [
                {
                    name: 'Ravi Kumar',
                    email: 'ravi.warrior@gmail.com',
                    contactNo: '9123456790',
                    gender: 'Male',
                    age: 20,
                    universityName: 'JK Lakshmipat University',
                    address: 'Jaipur, Rajasthan',
                    role: 'sniper'
                },
                {
                    name: 'Priya Sharma',
                    email: 'priya.alpha@gmail.com',
                    contactNo: '9123456791',
                    gender: 'Female',
                    age: 19,
                    universityName: 'JK Lakshmipat University',
                    address: 'Jaipur, Rajasthan',
                    role: 'assaulter'
                },
                {
                    name: 'Vikram Singh',
                    email: 'vikram.warrior@gmail.com',
                    contactNo: '9123456792',
                    gender: 'Male',
                    age: 22,
                    universityName: 'JK Lakshmipat University',
                    address: 'Jaipur, Rajasthan',
                    role: 'support'
                }
            ],
            paymentStatus: 'completed'
        };
        
        // Check if this is a dry run
        const args = process.argv.slice(2);
        const isDryRun = !args.includes('--execute');
        
        if (isDryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log('📋 Team data to be processed:');
            console.log(`   Team Name: ${teamData.teamName}`);
            console.log(`   Event: BGMI TOURNAMENT`);
            console.log(`   Team Leader: ${teamData.teamLeader.name} (${teamData.teamLeader.email})`);
            console.log(`   Team Members: ${teamData.teamMembers.length}`);
            teamData.teamMembers.forEach((member, index) => {
                console.log(`     ${index + 1}. ${member.name} (${member.email}) - ${member.role}`);
            });
            console.log(`   Payment Status: ${teamData.paymentStatus}`);
            console.log('\n⚠️  Actions that will be performed:');
            console.log('   - Create/update users in database');
            console.log('   - Add BGMI TOURNAMENT to user events');
            console.log('   - Create/update team composition');
            console.log('   - Update team registrations for all members');
            console.log('   - Generate QR codes for all users');
            console.log('   - Send registration emails to all users');
            console.log('\n📝 PLEASE UPDATE THE TEAM DATA BEFORE EXECUTING!');
            console.log('🚀 Use --execute flag to process the team: node bgmi-team-manager.js --execute');
            return;
        }
        
        // Validate team data
        if (!teamData.teamName || !teamData.teamLeader.email) {
            console.log('❌ Invalid team data! Please check team name and leader email.');
            return;
        }
        
        // Create or update the team
        const { team, teamLeader, members } = await createOrUpdateBGMITeam(teamData);
        
        // Generate QR codes for all users
        console.log('\n📱 Generating QR codes for all team members...');
        console.log('=' .repeat(50));
        
        const allUsers = [teamLeader];
        for (const memberInfo of members) {
            const member = await User.findById(memberInfo.userId);
            allUsers.push(member);
        }
        
        let qrSuccess = 0;
        let qrFailed = 0;
        
        for (const user of allUsers) {
            const qrResult = await generateQRForUser(user);
            if (qrResult) {
                qrSuccess++;
            } else {
                qrFailed++;
            }
        }
        
        console.log(`\n📊 QR Generation Summary: ${qrSuccess} successful, ${qrFailed} failed`);
        
        // Send emails to all users
        console.log('\n📧 Sending registration emails to all team members...');
        console.log('=' .repeat(50));
        
        let emailSuccess = 0;
        let emailFailed = 0;
        
        for (const user of allUsers) {
            const emailResult = await sendEmailToUser(user);
            if (emailResult) {
                emailSuccess++;
            } else {
                emailFailed++;
            }
        }
        
        console.log(`\n📊 Email Sending Summary: ${emailSuccess} successful, ${emailFailed} failed`);
        
        console.log('\n🎉 BGMI TEAM PROCESSING COMPLETED');
        console.log('=' .repeat(60));
        console.log('📊 Final Summary:');
        console.log(`   ✅ Team: ${team.teamName} (ID: ${team._id})`);
        console.log(`   ✅ Total members: ${team.totalMembers}`);
        console.log(`   ✅ QR codes generated: ${qrSuccess}/${allUsers.length}`);
        console.log(`   ✅ Emails sent: ${emailSuccess}/${allUsers.length}`);
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