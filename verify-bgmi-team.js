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

const verifyBGMITeam = async () => {
    try {
        await connectDB();
        
        console.log('🔍 Verifying BGMI TOURNAMENT Team Creation');
        console.log('=' .repeat(50));
        
        // Find the Phoenix Squad team
        const team = await TeamComposition.findOne({ 
            eventName: 'BGMI TOURNAMENT',
            teamName: 'Phoenix Squad'
        });
        
        if (!team) {
            console.log('❌ Team not found!');
            return;
        }
        
        console.log('🏆 TEAM FOUND:');
        console.log(`   Team ID: ${team._id}`);
        console.log(`   Team Name: ${team.teamName}`);
        console.log(`   Event: ${team.eventName}`);
        console.log(`   Total Members: ${team.totalMembers}`);
        console.log(`   Payment Status: ${team.paymentStatus}`);
        console.log(`   Registration Complete: ${team.registrationComplete}`);
        
        // Verify team leader
        console.log('\n👑 TEAM LEADER:');
        const leader = await User.findById(team.teamLeader.userId);
        if (leader) {
            console.log(`   ✅ ${leader.name} (${leader.email})`);
            console.log(`   📱 Contact: ${leader.contactNo}`);
            console.log(`   🎯 Events: [${leader.events.join(', ')}]`);
            console.log(`   ✅ Validated: ${leader.isvalidated}`);
            console.log(`   🏆 Team Registrations: ${leader.teamRegistrations.length}`);
        } else {
            console.log('   ❌ Team leader not found in User collection');
        }
        
        // Verify team members
        console.log('\n👥 TEAM MEMBERS:');
        for (let i = 0; i < team.teamMembers.length; i++) {
            const memberInfo = team.teamMembers[i];
            const member = await User.findById(memberInfo.userId);
            
            if (member) {
                console.log(`   ${i + 1}. ✅ ${member.name} (${member.email})`);
                console.log(`      📱 Contact: ${member.contactNo}`);
                console.log(`      👤 Role: ${memberInfo.role}`);
                console.log(`      🎯 Events: [${member.events.join(', ')}]`);
                console.log(`      ✅ Validated: ${member.isvalidated}`);
                console.log(`      🏆 Team Registrations: ${member.teamRegistrations.length}`);
            } else {
                console.log(`   ${i + 1}. ❌ Member not found: ${memberInfo.name}`);
            }
        }
        
        // Check all BGMI users
        console.log('\n📊 ALL BGMI TOURNAMENT PARTICIPANTS:');
        const bgmiUsers = await User.find({ events: 'BGMI TOURNAMENT' });
        console.log(`   Total BGMI participants: ${bgmiUsers.length}`);
        
        // Check all BGMI teams
        const bgmiTeams = await TeamComposition.find({ eventName: 'BGMI TOURNAMENT' });
        console.log(`   Total BGMI teams: ${bgmiTeams.length}`);
        
        console.log('\n✅ VERIFICATION COMPLETED - Team successfully added to database!');
        
    } catch (error) {
        console.error('❌ Verification error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
};

verifyBGMITeam();