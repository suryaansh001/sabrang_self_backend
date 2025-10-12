const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
require('dotenv').config();

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

const deleteBGMITeam = async () => {
    try {
        await connectDB();
        
        console.log('🗑️  BGMI Team Deletion Script');
        console.log('=' .repeat(50));
        
        // Find the Phoenix Squad team
        const team = await TeamComposition.findOne({ 
            eventName: 'BGMI TOURNAMENT',
            teamName: 'Phoenix Squad'
        });
        
        if (!team) {
            console.log('❌ Phoenix Squad team not found!');
            return;
        }
        
        console.log('🔍 Found team to delete:');
        console.log(`   Team ID: ${team._id}`);
        console.log(`   Team Name: ${team.teamName}`);
        console.log(`   Event: ${team.eventName}`);
        console.log(`   Total Members: ${team.totalMembers}`);
        
        // Check if this is a dry run
        const args = process.argv.slice(2);
        const isDryRun = !args.includes('--execute');
        
        if (isDryRun) {
            console.log('\n🔍 DRY RUN MODE - No changes will be made');
            console.log('📋 Actions that would be performed:');
            
            // Show team leader
            const leader = await User.findById(team.teamLeader.userId);
            if (leader) {
                console.log(`\n👑 Team Leader: ${leader.name} (${leader.email})`);
                console.log(`   - Remove BGMI TOURNAMENT from events array`);
                console.log(`   - Remove team registration entry`);
                console.log(`   - Delete user from database: ${leader._id}`);
            }
            
            // Show team members
            console.log('\n👥 Team Members:');
            for (let i = 0; i < team.teamMembers.length; i++) {
                const memberInfo = team.teamMembers[i];
                const member = await User.findById(memberInfo.userId);
                if (member) {
                    console.log(`   ${i + 1}. ${member.name} (${member.email})`);
                    console.log(`      - Remove BGMI TOURNAMENT from events array`);
                    console.log(`      - Remove team registration entry`);
                    console.log(`      - Delete user from database: ${member._id}`);
                }
            }
            
            console.log(`\n🏆 Team Composition:`);
            console.log(`   - Delete team composition: ${team._id}`);
            
            console.log('\n🚀 Use --execute flag to actually delete the team: node delete-bgmi-team.js --execute');
            return;
        }
        
        console.log('\n🗑️  EXECUTING DELETION...');
        
        let deletedUsers = 0;
        let updatedUsers = 0;
        
        // Process team leader
        const leader = await User.findById(team.teamLeader.userId);
        if (leader) {
            console.log(`\n👑 Processing team leader: ${leader.name}`);
            
            // Remove BGMI TOURNAMENT from events
            leader.events = leader.events.filter(event => event !== 'BGMI TOURNAMENT');
            
            // Remove team registration
            leader.teamRegistrations = leader.teamRegistrations.filter(
                reg => !reg.teamCompositionId?.equals(team._id)
            );
            
            // If user has no other events, delete them; otherwise update
            if (leader.events.length === 0) {
                await User.findByIdAndDelete(leader._id);
                console.log(`   ✅ User deleted: ${leader.name}`);
                deletedUsers++;
            } else {
                leader.updatedAt = new Date();
                await leader.save();
                console.log(`   ✅ User updated: ${leader.name} (still has events: [${leader.events.join(', ')}])`);
                updatedUsers++;
            }
        }
        
        // Process team members
        console.log('\n👥 Processing team members:');
        for (let i = 0; i < team.teamMembers.length; i++) {
            const memberInfo = team.teamMembers[i];
            const member = await User.findById(memberInfo.userId);
            
            if (member) {
                console.log(`   ${i + 1}. Processing: ${member.name}`);
                
                // Remove BGMI TOURNAMENT from events
                member.events = member.events.filter(event => event !== 'BGMI TOURNAMENT');
                
                // Remove team registration
                member.teamRegistrations = member.teamRegistrations.filter(
                    reg => !reg.teamCompositionId?.equals(team._id)
                );
                
                // If user has no other events, delete them; otherwise update
                if (member.events.length === 0) {
                    await User.findByIdAndDelete(member._id);
                    console.log(`      ✅ User deleted: ${member.name}`);
                    deletedUsers++;
                } else {
                    member.updatedAt = new Date();
                    await member.save();
                    console.log(`      ✅ User updated: ${member.name} (still has events: [${member.events.join(', ')}])`);
                    updatedUsers++;
                }
            }
        }
        
        // Delete team composition
        console.log('\n🏆 Deleting team composition...');
        await TeamComposition.findByIdAndDelete(team._id);
        console.log(`   ✅ Team composition deleted: ${team.teamName}`);
        
        console.log('\n🎉 TEAM DELETION COMPLETED');
        console.log('=' .repeat(50));
        console.log('📊 Summary:');
        console.log(`   ✅ Team deleted: ${team.teamName}`);
        console.log(`   ✅ Users completely deleted: ${deletedUsers}`);
        console.log(`   ✅ Users updated (kept): ${updatedUsers}`);
        console.log(`   ✅ Team composition removed from database`);
        
    } catch (error) {
        console.error('❌ Deletion error:', error);
    } finally {
        console.log('\n📴 Disconnecting from MongoDB');
        await mongoose.disconnect();
        process.exit(0);
    }
};

deleteBGMITeam().catch(console.error);