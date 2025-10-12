const mongoose = require('mongoose');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();
const { User, Purchase, TeamComposition, UpdatedUser } = require('./models/models');

// Connection URI from environment
const MONGO_URI = process.env.mongodb || "mongodb://localhost:27017/sabrang";

// Function to connect to MongoDB
async function connectToMongoDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB successfully!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

// Function to create Excel report
function createExcelReport(data, filename) {
    if (data.length === 0) {
        console.log(`No data to write to ${filename}`);
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
    console.log(`Excel file created: ${filename}`);
}

// Main function to analyze team compositions and user relationships
async function analyzeTeamCompositions() {
    try {
        await connectToMongoDB();
        
        console.log("=== ANALYZING TEAM COMPOSITIONS AND USER RELATIONSHIPS ===");
        
        // Get all team compositions
        const allTeams = await TeamComposition.find({});
        console.log(`Total Team Compositions: ${allTeams.length}`);
        
        // Get all users
        const allUsers = await User.find({});
        console.log(`Total Users: ${allUsers.length}`);
        
        // Get all purchases
        const allPurchases = await Purchase.find({});
        console.log(`Total Purchases: ${allPurchases.length}`);
        
        // Analyze team memberships
        const teamAnalysis = [];
        const userTeamMap = new Map(); // userId -> team info
        
        for (const team of allTeams) {
            // Add team leader
            const leaderId = team.teamLeader.userId.toString();
            if (!userTeamMap.has(leaderId)) {
                userTeamMap.set(leaderId, {
                    userId: leaderId,
                    userName: team.teamLeader.name,
                    userEmail: team.teamLeader.email,
                    asLeader: 0,
                    asMember: 0,
                    teams: []
                });
            }
            const leaderInfo = userTeamMap.get(leaderId);
            leaderInfo.asLeader++;
            leaderInfo.teams.push({
                eventName: team.eventName,
                teamName: team.teamName,
                role: 'Leader'
            });
            
            // Add team members
            for (const member of team.teamMembers) {
                const memberId = member.userId.toString();
                if (!userTeamMap.has(memberId)) {
                    userTeamMap.set(memberId, {
                        userId: memberId,
                        userName: member.name,
                        userEmail: member.email,
                        asLeader: 0,
                        asMember: 0,
                        teams: []
                    });
                }
                const memberInfo = userTeamMap.get(memberId);
                memberInfo.asMember++;
                memberInfo.teams.push({
                    eventName: team.eventName,
                    teamName: team.teamName,
                    role: 'Member'
                });
            }
            
            teamAnalysis.push({
                'Team ID': team._id.toString(),
                'Event Name': team.eventName,
                'Team Name': team.teamName,
                'Leader ID': team.teamLeader.userId.toString(),
                'Leader Name': team.teamLeader.name,
                'Leader Email': team.teamLeader.email,
                'Total Members': team.totalMembers,
                'Member Count': team.teamMembers.length,
                'Registration Complete': team.registrationComplete,
                'Payment Status': team.paymentStatus,
                'Purchase ID': team.purchaseId ? team.purchaseId.toString() : 'N/A',
                'Created At': team.createdAt.toISOString()
            });
        }
        
        console.log(`Unique users in teams: ${userTeamMap.size}`);
        
        // Convert team user map to array for reporting
        const teamUsers = Array.from(userTeamMap.values()).map(user => ({
            'User ID': user.userId,
            'User Name': user.userName,
            'User Email': user.userEmail,
            'As Leader': user.asLeader,
            'As Member': user.asMember,
            'Total Team Participations': user.asLeader + user.asMember,
            'Teams': user.teams.map(t => `${t.eventName} (${t.teamName}) - ${t.role}`).join('; ')
        }));
        
        // Analyze users not in any team
        const usersNotInTeams = [];
        for (const user of allUsers) {
            const userId = user._id.toString();
            if (!userTeamMap.has(userId)) {
                // Check if user has any purchases
                const userPurchases = await Purchase.find({ userId: user._id });
                
                usersNotInTeams.push({
                    'User ID': userId,
                    'User Name': user.name,
                    'User Email': user.email,
                    'Events': user.events.join(', '),
                    'Is Validated': user.isvalidated,
                    'Team Registrations Count': user.teamRegistrations ? user.teamRegistrations.length : 0,
                    'Team Registrations': user.teamRegistrations ? user.teamRegistrations.map(tr => tr.eventName).join(', ') : 'None',
                    'Purchase Count': userPurchases.length,
                    'Purchase IDs': userPurchases.map(p => p._id.toString()).join(', '),
                    'University': user.universityName || 'N/A',
                    'Created At': user.createdAt.toISOString()
                });
            }
        }
        
        console.log(`Users not in any team composition: ${usersNotInTeams.length}`);
        
        // Analyze purchase vs team relationships
        const purchaseTeamAnalysis = [];
        for (const purchase of allPurchases) {
            const userId = purchase.userId ? purchase.userId.toString() : null;
            const userTeamInfo = userId ? userTeamMap.get(userId) : null;
            
            purchaseTeamAnalysis.push({
                'Purchase ID': purchase._id.toString(),
                'Order ID': purchase.orderId,
                'Cashfree Order ID': purchase.cashfreeOrderId || 'N/A',
                'User ID': userId || 'N/A',
                'User Name': purchase.userDetails?.name || 'N/A',
                'User Email': purchase.userDetails?.email || 'N/A',
                'Payment Status': purchase.paymentStatus,
                'Total Amount': purchase.totalAmount,
                'Is Team Member': userTeamInfo ? 'Yes' : 'No',
                'Team Leader Count': userTeamInfo ? userTeamInfo.asLeader : 0,
                'Team Member Count': userTeamInfo ? userTeamInfo.asMember : 0,
                'Purchase Date': purchase.purchaseDate.toISOString(),
                'Items': purchase.items.map(item => item.itemName).join(', ')
            });
        }
        
        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        // Create reports
        createExcelReport(teamAnalysis, `${outputDir}/team_compositions_analysis.xlsx`);
        createExcelReport(teamUsers, `${outputDir}/users_in_teams.xlsx`);
        createExcelReport(usersNotInTeams, `${outputDir}/users_not_in_teams.xlsx`);
        createExcelReport(purchaseTeamAnalysis, `${outputDir}/purchase_team_relationship.xlsx`);
        
        // Create summary
        const summary = [
            { 'Metric': 'Total Team Compositions', 'Count': allTeams.length },
            { 'Metric': 'Total Users', 'Count': allUsers.length },
            { 'Metric': 'Users in Teams', 'Count': userTeamMap.size },
            { 'Metric': 'Users NOT in Teams', 'Count': usersNotInTeams.length },
            { 'Metric': 'Total Purchases', 'Count': allPurchases.length },
            { 'Metric': 'Team Coverage %', 'Count': `${((userTeamMap.size / allUsers.length) * 100).toFixed(2)}%` }
        ];
        
        createExcelReport(summary, `${outputDir}/team_analysis_summary.xlsx`);
        
        console.log("\n=== ANALYSIS COMPLETE ===");
        console.log("Files created:");
        console.log("1. team_compositions_analysis.xlsx - All team compositions");
        console.log("2. users_in_teams.xlsx - Users who are in teams");
        console.log("3. users_not_in_teams.xlsx - Users who are NOT in any team");
        console.log("4. purchase_team_relationship.xlsx - Purchase vs team membership");
        console.log("5. team_analysis_summary.xlsx - Summary statistics");
        
        // Show some stats
        console.log("\n=== KEY STATISTICS ===");
        console.log(`Total teams: ${allTeams.length}`);
        console.log(`Total users: ${allUsers.length}`);
        console.log(`Users in teams: ${userTeamMap.size} (${((userTeamMap.size / allUsers.length) * 100).toFixed(2)}%)`);
        console.log(`Users NOT in teams: ${usersNotInTeams.length} (${((usersNotInTeams.length / allUsers.length) * 100).toFixed(2)}%)`);
        
        // Show event breakdown
        const eventBreakdown = {};
        allTeams.forEach(team => {
            eventBreakdown[team.eventName] = (eventBreakdown[team.eventName] || 0) + 1;
        });
        
        console.log("\n=== EVENTS WITH TEAMS ===");
        Object.entries(eventBreakdown).forEach(([event, count]) => {
            console.log(`${event}: ${count} teams`);
        });
        
    } catch (error) {
        console.error("Error in analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the analysis
analyzeTeamCompositions();