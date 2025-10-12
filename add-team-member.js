const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
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
            console.log(`   ✅ User already exists: ${user.name} (${user._id})`);
            return user;
        }
        
        // Create new user
        console.log(`   🆕 Creating new user: ${userData.name}`);
        user = new User({
            name: userData.name,
            email: userData.email,
            contactNo: userData.contactNo || '',
            address: userData.address || '',
            events: [], // Will be updated when added to team
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

// Function to add member to team
const addMemberToTeam = async (teamId, memberData) => {
    try {
        console.log(`\n🏆 Adding member to team: ${teamId}`);
        
        // Find the team
        const team = await TeamComposition.findById(teamId);
        if (!team) {
            throw new Error(`Team not found with ID: ${teamId}`);
        }
        
        console.log(`   📋 Found team: ${team.teamName} (${team.eventName})`);
        console.log(`   👥 Current members: ${team.totalMembers}`);
        
        // Create or find the user
        const user = await createOrFindUser(memberData);
        
        // Check if user is already in the team
        const existingMember = team.teamMembers.find(member => 
            member.userId.toString() === user._id.toString()
        );
        
        if (existingMember) {
            console.log(`   ⚠️  User is already a member of this team`);
            return { success: false, reason: 'ALREADY_MEMBER' };
        }
        
        // Check if user is the team leader
        if (team.teamLeader.userId.toString() === user._id.toString()) {
            console.log(`   ⚠️  User is already the team leader`);
            return { success: false, reason: 'IS_TEAM_LEADER' };
        }
        
        // Add event to user's events array if not present
        if (!user.events.includes(team.eventName)) {
            user.events.push(team.eventName);
            console.log(`   ✅ Added ${team.eventName} to user's events`);
        }
        
        // Add team registration to user
        const existingTeamReg = user.teamRegistrations.find(reg => 
            reg.teamCompositionId && reg.teamCompositionId.toString() === team._id.toString()
        );
        
        if (!existingTeamReg) {
            user.teamRegistrations.push({
                eventName: team.eventName,
                teamLeaderId: team.teamLeader.userId,
                isTeamLeader: false,
                teamName: team.teamName,
                teamCompositionId: team._id,
                registeredAt: new Date()
            });
            console.log(`   ✅ Added team registration to user`);
        }
        
        user.updatedAt = new Date();
        await user.save();
        
        // Add member to team
        team.teamMembers.push({
            userId: user._id,
            name: user.name,
            email: user.email,
            hasEntered: false,
            role: 'member'
        });
        
        // Increment total members
        team.totalMembers += 1;
        
        // Update team entry status
        team.teamEntryStatus.pendingEntry += 1;
        team.updatedAt = new Date();
        
        await team.save();
        
        console.log(`   ✅ Member added to team successfully!`);
        console.log(`   👤 Member: ${user.name} (${user._id})`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👥 New total members: ${team.totalMembers}`);
        
        return { 
            success: true, 
            user: user,
            team: team,
            memberCount: team.totalMembers
        };
        
    } catch (error) {
        console.error('❌ Error adding member to team:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();
        
        console.log('👥 Add Team Member Script');
        console.log('=' .repeat(40));
        
        // Target team ID and member data
        const teamId = '68e0ce58910012fdebcf1f65';
        const memberData = {
            name: 'Daksh Shukla',
            email: 'dakshshukla@jklu.edu.in',
            contactNo: '8824809316',
            address: 'Mahima panorama'
        };
        
        // Check if this is a dry run
        const args = process.argv.slice(2);
        const isDryRun = !args.includes('--execute');
        
        if (isDryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log('📋 Member to be added:');
            console.log(`   Name: ${memberData.name}`);
            console.log(`   Email: ${memberData.email}`);
            console.log(`   Contact: ${memberData.contactNo}`);
            console.log(`   Address: ${memberData.address}`);
            console.log(`   Team ID: ${teamId}`);
            console.log('\n🚀 Use --execute flag to add the member: node add-team-member.js --execute');
            return;
        }
        
        // Add member to team
        const result = await addMemberToTeam(teamId, memberData);
        
        if (result.success) {
            console.log('\n🎉 MEMBER ADDITION COMPLETED');
            console.log('=' .repeat(40));
            console.log('📊 Summary:');
            console.log(`   ✅ Member added: ${result.user.name}`);
            console.log(`   ✅ User ID: ${result.user._id}`);
            console.log(`   ✅ Team: ${result.team.teamName}`);
            console.log(`   ✅ Event: ${result.team.eventName}`);
            console.log(`   ✅ Total team members: ${result.memberCount}`);
            console.log(`   ✅ User validated and events updated`);
        } else {
            console.log(`\n❌ Failed to add member: ${result.reason}`);
        }
        
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