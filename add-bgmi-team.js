const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');
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

// Function to create or find a user
const createOrFindUser = async (userData) => {
    try {
        console.log(`🔍 Looking for user: ${userData.name} (${userData.email})`);
        
        // Check if user already exists
        let user = await User.findOne({ email: userData.email });
        
        if (user) {
            console.log(`   ✅ User already exists: ${user.name}`);
            
            // Add BGMI TOURNAMENT to events if not already present
            if (!user.events.includes('BGMI TOURNAMENT')) {
                user.events.push('BGMI TOURNAMENT');
                user.updatedAt = new Date();
                await user.save();
                console.log(`   ✅ Added BGMI TOURNAMENT to user's events`);
            }
            
            return user;
        }
        
        // Create new user
        console.log(`   🆕 Creating new user: ${userData.name}`);
        user = new User({
            name: userData.name,
            email: userData.email,
            contactNo: userData.contactNo || '',
            gender: userData.gender || '',
            age: userData.age || null,
            universityName: userData.universityName || '',
            address: userData.address || '',
            events: ['BGMI TOURNAMENT'],
            isvalidated: true, // Set as validated since they're being added manually
            hasEntered: false,
            userType: 'participant',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await user.save();
        console.log(`   ✅ User created successfully: ${user._id}`);
        return user;
        
    } catch (error) {
        console.error(`   ❌ Error creating user ${userData.name}:`, error);
        throw error;
    }
};

// Function to create the BGMI team
const createBGMITeam = async (teamData) => {
    try {
        console.log(`\n🏆 Creating BGMI TOURNAMENT team: ${teamData.teamName}`);
        
        // Create team leader
        const teamLeader = await createOrFindUser(teamData.teamLeader);
        
        // Create team members
        const teamMembers = [];
        for (const memberData of teamData.teamMembers) {
            const member = await createOrFindUser(memberData);
            teamMembers.push({
                userId: member._id,
                name: member.name,
                email: member.email,
                hasEntered: false,
                role: memberData.role || 'member'
            });
        }
        
        // Create team composition
        const teamComposition = new TeamComposition({
            eventName: 'BGMI TOURNAMENT',
            teamName: teamData.teamName,
            teamLeader: {
                userId: teamLeader._id,
                name: teamLeader.name,
                email: teamLeader.email,
                hasEntered: false
            },
            teamMembers: teamMembers,
            totalMembers: teamMembers.length + 1, // +1 for team leader
            maxTeamSize: 4, // BGMI is typically 4-player teams
            registrationComplete: true,
            teamEntryStatus: {
                totalEntered: 0,
                pendingEntry: teamMembers.length + 1,
                allEntered: false
            },
            paymentStatus: teamData.paymentStatus || 'completed',
            purchaseId: teamData.purchaseId || null,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await teamComposition.save();
        console.log(`✅ Team composition created: ${teamComposition._id}`);
        
        // Update team leader's team registrations
        teamLeader.teamRegistrations.push({
            eventName: 'BGMI TOURNAMENT',
            teamLeaderId: teamLeader._id,
            isTeamLeader: true,
            teamName: teamData.teamName,
            teamCompositionId: teamComposition._id,
            registeredAt: new Date()
        });
        await teamLeader.save();
        
        // Update team members' team registrations
        for (let i = 0; i < teamMembers.length; i++) {
            const member = await User.findById(teamMembers[i].userId);
            member.teamRegistrations.push({
                eventName: 'BGMI TOURNAMENT',
                teamLeaderId: teamLeader._id,
                isTeamLeader: false,
                teamName: teamData.teamName,
                teamCompositionId: teamComposition._id,
                registeredAt: new Date()
            });
            await member.save();
        }
        
        console.log(`✅ Team created successfully!`);
        console.log(`   Team ID: ${teamComposition._id}`);
        console.log(`   Team Name: ${teamData.teamName}`);
        console.log(`   Total Members: ${teamComposition.totalMembers}`);
        console.log(`   Payment Status: ${teamComposition.paymentStatus}`);
        
        return teamComposition;
        
    } catch (error) {
        console.error('❌ Error creating BGMI team:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();
        
        console.log('🎯 BGMI TOURNAMENT Team Creation Script');
        console.log('=' .repeat(50));
        
        // Actual BGMI team data
        const teamData = {
            teamName: 'Phoenix Squad',
            teamLeader: {
                name: 'Arjun Kumar',
                email: 'arjun.phoenix@gmail.com',
                contactNo: '9876543210',
                gender: 'Male',
                age: 21,
                universityName: 'JK Lakshmipat University',
                address: 'Jaipur, Rajasthan'
            },
            teamMembers: [
                {
                    name: 'Rohit Sharma',
                    email: 'rohit.gamer@gmail.com',
                    contactNo: '9876543211',
                    gender: 'Male',
                    age: 20,
                    universityName: 'JK Lakshmipat University',
                    address: 'Jaipur, Rajasthan',
                    role: 'sniper'
                },
                {
                    name: 'Priya Singh',
                    email: 'priya.bgmi@gmail.com',
                    contactNo: '9876543212',
                    gender: 'Female',
                    age: 19,
                    universityName: 'JK Lakshmipat University',
                    address: 'Jaipur, Rajasthan',
                    role: 'assaulter'
                },
                {
                    name: 'Vikash Yadav',
                    email: 'vikash.phoenix@gmail.com',
                    contactNo: '9876543213',
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
            console.log('📋 Team data to be created:');
            console.log(`   Team Name: ${teamData.teamName}`);
            console.log(`   Event: BGMI TOURNAMENT`);
            console.log(`   Team Leader: ${teamData.teamLeader.name} (${teamData.teamLeader.email})`);
            console.log(`   Team Members: ${teamData.teamMembers.length}`);
            teamData.teamMembers.forEach((member, index) => {
                console.log(`     ${index + 1}. ${member.name} (${member.email})`);
            });
            console.log(`   Payment Status: ${teamData.paymentStatus}`);
            console.log('\n⚠️  PLEASE UPDATE THE TEAM DATA IN THE SCRIPT BEFORE EXECUTING!');
            console.log('📝 Edit the teamData object in this script with actual information');
            console.log('🚀 Use --execute flag to create the team: node add-bgmi-team.js --execute');
            return;
        }
        
        // Validate team data before creation
        if (!teamData.teamName || !teamData.teamLeader.email) {
            console.log('❌ Invalid team data! Please check team name and leader email.');
            return;
        }
        
        // Create the team
        const team = await createBGMITeam(teamData);
        
        console.log('\n🎉 BGMI TEAM CREATION COMPLETED');
        console.log('=' .repeat(50));
        console.log('📊 Summary:');
        console.log(`   ✅ Team created: ${team.teamName}`);
        console.log(`   ✅ Team ID: ${team._id}`);
        console.log(`   ✅ Total members: ${team.totalMembers}`);
        console.log(`   ✅ All users validated and added to database`);
        console.log(`   ✅ Team registrations updated for all members`);
        
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