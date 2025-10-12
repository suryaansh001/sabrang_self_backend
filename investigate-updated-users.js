/**
 * Investigate Updated Users Script
 * 
 * This script investigates the 56 users who were updated to see if they might be
 * team members who should have access through their team leader's payment.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, Purchase, TeamComposition } = require('./models/models');

async function investigateUpdatedUsers() {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('✅ Connected to MongoDB');
        
        // Read the results CSV to get the users that were updated
        const updatedUsers = [];
        
        if (!fs.existsSync('./validation_status_update_results_2025-10-10.csv')) {
            console.log('❌ Results CSV file not found');
            return;
        }
        
        // Read the results file
        await new Promise((resolve, reject) => {
            fs.createReadStream('./validation_status_update_results_2025-10-10.csv')
                .pipe(csv())
                .on('data', (row) => {
                    if (row.shouldUpdate === 'true' && row.reason === 'VALIDATED_WITHOUT_PAYMENT') {
                        updatedUsers.push({
                            email: row.email,
                            userName: row.userName,
                            events: row.events
                        });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
        
        console.log(`🔍 Investigating ${updatedUsers.length} users who were updated...`);
        console.log('\n📋 DETAILED ANALYSIS OF UPDATED USERS:');
        console.log('='.repeat(60));
        
        let teamMemberCount = 0;
        let individualCount = 0;
        let potentialTeamIssues = [];
        
        for (let i = 0; i < updatedUsers.length; i++) {
            const userData = updatedUsers[i];
            console.log(`\n${i + 1}. ${userData.userName} (${userData.email})`);
            console.log(`   Events: ${userData.events}`);
            
            // Check if user exists in database (after our update)
            const user = await User.findOne({ email: userData.email });
            if (!user) {
                console.log('   ❌ User not found in database');
                continue;
            }
            
            // Check team registrations
            console.log(`   Team Registrations: ${user.teamRegistrations?.length || 0}`);
            if (user.teamRegistrations && user.teamRegistrations.length > 0) {
                user.teamRegistrations.forEach((teamReg, idx) => {
                    console.log(`     ${idx + 1}. Event: ${teamReg.eventName}, Team Leader: ${teamReg.isTeamLeader ? 'YES' : 'NO'}`);
                });
            }
            
            // Check if user is in any team compositions
            const teamCompositions = await TeamComposition.find({
                $or: [
                    { 'teamLeader.userId': user._id },
                    { 'teamMembers.userId': user._id }
                ]
            });
            
            let isTeamMember = false;
            
            if (teamCompositions.length > 0) {
                console.log(`   📊 Found in ${teamCompositions.length} team composition(s):`);
                isTeamMember = true;
                teamMemberCount++;
                
                for (const team of teamCompositions) {
                    const isLeader = team.teamLeader.userId.toString() === user._id.toString();
                    console.log(`     - ${team.eventName}: ${team.teamName} (${isLeader ? 'LEADER' : 'MEMBER'})`);
                    console.log(`       Payment Status: ${team.paymentStatus}`);
                    console.log(`       Total Members: ${team.totalMembers}`);
                    
                    // If team has completed payment but user was marked unvalidated, this might be wrong
                    if (team.paymentStatus === 'completed') {
                        console.log(`       ⚠️ CRITICAL: Team payment completed but user was invalidated!`);
                        potentialTeamIssues.push({
                            user: userData,
                            team: team,
                            issue: 'Team payment completed but user invalidated'
                        });
                    }
                }
            } else {
                console.log(`   📊 Not found in any team compositions - likely individual registration`);
                individualCount++;
            }
            
            // Check if there are any purchases linked to this user
            const relatedPurchases = await Purchase.find({
                $or: [
                    { userId: user._id },
                    { mainPersonId: user._id },
                    { 'userDetails.email': userData.email }
                ]
            });
            
            if (relatedPurchases.length > 0) {
                console.log(`   💳 Related purchases: ${relatedPurchases.length}`);
                relatedPurchases.forEach((purchase, idx) => {
                    console.log(`     ${idx + 1}. Order: ${purchase.orderId}, Status: ${purchase.paymentStatus}, Amount: ₹${purchase.totalAmount}`);
                });
            } else {
                console.log(`   💳 No direct purchases found`);
                
                // If no direct purchases but is team member, this might be expected
                if (isTeamMember) {
                    console.log(`   ℹ️ This is expected for team members (payment through team leader)`);
                }
            }
            
            console.log(`   Current Status: isvalidated = ${user.isvalidated}, hasQR = ${!!(user.qrPath || user.qrCodeBase64)}`);
        }
        
        console.log('\n📈 SUMMARY:');
        console.log('='.repeat(30));
        console.log(`👥 Team Members: ${teamMemberCount}`);
        console.log(`👤 Individual Registrations: ${individualCount}`);
        console.log(`🔄 Total Updated: ${updatedUsers.length}`);
        console.log(`⚠️ Potential Issues: ${potentialTeamIssues.length}`);
        
        if (potentialTeamIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES FOUND:');
            console.log('='.repeat(40));
            potentialTeamIssues.forEach((issue, idx) => {
                console.log(`${idx + 1}. ${issue.user.userName} (${issue.user.email})`);
                console.log(`   Team: ${issue.team.teamName} - ${issue.team.eventName}`);
                console.log(`   Issue: ${issue.issue}`);
                console.log(`   Team Payment Status: ${issue.team.paymentStatus}`);
            });
            
            console.log('\n⚠️ RECOMMENDATION:');
            console.log('These users appear to be team members whose teams have completed');
            console.log('payment. They should probably be re-validated as they get access');
            console.log('through their team leader\'s payment, not individual payments.');
        }
        
        if (teamMemberCount > 0) {
            console.log('\n⚠️ ANALYSIS RESULT:');
            console.log(`${teamMemberCount} out of ${updatedUsers.length} users appear to be team members.`);
            console.log('Team members often get access through their team leader\'s payment,');
            console.log('not through individual payments. This update might have been incorrect');
            console.log('for these users.');
            console.log('\nNext steps:');
            console.log('1. Review each team\'s payment status');
            console.log('2. Re-validate team members whose teams have completed payment');
            console.log('3. Update validation logic to consider team-based payments');
        }
        
    } catch (error) {
        console.error('❌ Error during investigation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📴 Disconnected from MongoDB');
    }
}

// Run the investigation
investigateUpdatedUsers();