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

// Function to create CSV report
function createCSVReport(data, filename) {
    if (data.length === 0) {
        console.log(`No data to write to ${filename}`);
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    fs.writeFileSync(filename, csvContent);
    console.log(`CSV file created: ${filename}`);
}

// Function to normalize event names (group visitor pass variants)
function normalizeEventName(eventName) {
    const visitorPassVariants = [
        'VISITOR_PASS',
        'VISITOR PASS',
        'Visitor Pass',
        'VISITOR PASS (1 DAY)',
        'VISITOR PASS 3 DAYS',
        'VISITOR PASS 1 day'
    ];

    if (visitorPassVariants.includes(eventName)) {
        return 'VISITOR_PASS';
    }

    return eventName;
}

// Main function to analyze event participants and teams
async function analyzeEventParticipants() {
    try {
        await connectToMongoDB();

        console.log("=== ANALYZING EVENT PARTICIPANTS AND TEAMS ===");

        // Get all users from main Users collection
        const allUsers = await User.find({});
        console.log(`Total Users in main collection: ${allUsers.length}`);

        // Get all users from UpdatedUser collection
        const updatedUsers = await UpdatedUser.find({});
        console.log(`Total Users in UpdatedUser collection: ${updatedUsers.length}`);

        // Combine all users
        const allUsersCombined = [...allUsers, ...updatedUsers];
        console.log(`Total combined users: ${allUsersCombined.length}`);

        // Get all team compositions to identify team events
        const allTeams = await TeamComposition.find({});
        console.log(`Total teams found: ${allTeams.length}`);

        // Identify team events
        const teamEvents = [...new Set(allTeams.map(team => team.eventName))];
        console.log(`Team events identified: ${teamEvents.join(', ')}`);

        // Collect all unique events from users
        const allEvents = new Set();
        for (const user of allUsersCombined) {
            if (user.events && Array.isArray(user.events)) {
                user.events.forEach(event => {
                    allEvents.add(normalizeEventName(event));
                });
            }
        }

        // Separate individual and team events
        const individualEvents = Array.from(allEvents).filter(event => !teamEvents.includes(event));
        const teamEventsNormalized = teamEvents.map(event => normalizeEventName(event));

        console.log(`Individual events: ${individualEvents.length}`);
        console.log(`Team events: ${teamEventsNormalized.length}`);

        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Process individual events
        console.log("\n=== PROCESSING INDIVIDUAL EVENTS ===");
        const individualEventReports = [];

        for (const eventName of individualEvents) {
            const participants = [];

            for (const user of allUsersCombined) {
                if (user.events && user.events.some(e => normalizeEventName(e) === eventName)) {
                    participants.push({
                        'Event Name': eventName,
                        'User ID': user._id.toString(),
                        'Name': user.name,
                        'Email': user.email,
                        'Contact': user.contactNo || 'N/A',
                        'University': user.universityName || 'N/A',
                        'Gender': user.gender || 'N/A',
                        'Age': user.age || 'N/A',
                        'Is Validated': user.isvalidated,
                        'User Type': user.userType || 'participant',
                        'Has QR': (user.qrPath || user.qrCodeBase64) ? 'Yes' : 'No',
                        'Registration Date': user.createdAt.toISOString().split('T')[0]
                    });
                }
            }

            if (participants.length > 0) {
                individualEventReports.push(...participants);

                // Create separate CSV for each individual event
                createCSVReport(participants, `${outputDir}/individual_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_participants.csv`);

                console.log(`${eventName}: ${participants.length} participants`);
            }
        }

        // Process team events
        console.log("\n=== PROCESSING TEAM EVENTS ===");
        const teamEventReports = [];

        for (const eventName of teamEvents) {
            const normalizedEventName = normalizeEventName(eventName);
            const eventTeams = allTeams.filter(team => team.eventName === eventName);

            console.log(`${normalizedEventName}: ${eventTeams.length} teams`);

            for (const team of eventTeams) {
                // Get leader details
                const leader = team.teamLeader;
                let leaderDetails = {
                    name: leader.name || 'N/A',
                    email: leader.email || 'N/A',
                    contact: 'N/A',
                    university: 'N/A'
                };

                // Try to get more details from user collections
                const leaderUser = allUsersCombined.find(u => u._id.toString() === leader.userId.toString());
                if (leaderUser) {
                    leaderDetails = {
                        name: leaderUser.name,
                        email: leaderUser.email,
                        contact: leaderUser.contactNo || 'N/A',
                        university: leaderUser.universityName || 'N/A'
                    };
                }

                // Get member details
                const members = [];
                for (const member of team.teamMembers) {
                    let memberDetails = {
                        name: member.name || 'N/A',
                        email: member.email || 'N/A',
                        contact: 'N/A',
                        university: 'N/A',
                        role: member.role || 'Member'
                    };

                    // Try to get more details from user collections
                    const memberUser = allUsersCombined.find(u => u._id.toString() === member.userId.toString());
                    if (memberUser) {
                        memberDetails = {
                            name: memberUser.name,
                            email: memberUser.email,
                            contact: memberUser.contactNo || 'N/A',
                            university: memberUser.universityName || 'N/A',
                            role: member.role || 'Member'
                        };
                    }

                    members.push(memberDetails);
                }

                // Create team report entry
                const teamEntry = {
                    'Event Name': normalizedEventName,
                    'Team Name': team.teamName,
                    'Team Size': team.totalMembers,
                    'Leader Name': leaderDetails.name,
                    'Leader Email': leaderDetails.email,
                    'Leader Contact': leaderDetails.contact,
                    'Leader University': leaderDetails.university,
                    'Members Count': members.length,
                    'Members Details': members.map(m => `${m.name} (${m.email})`).join('; '),
                    'Team Created': team.createdAt.toISOString().split('T')[0]
                };

                teamEventReports.push(teamEntry);

                // Also create detailed member list for this team
                const memberList = members.map((member, index) => ({
                    'Event Name': normalizedEventName,
                    'Team Name': team.teamName,
                    'Member Number': index + 1,
                    'Member Name': member.name,
                    'Member Email': member.email,
                    'Member Contact': member.contact,
                    'Member University': member.university,
                    'Member Role': member.role,
                    'Is Leader': 'No'
                }));

                // Add leader as first member
                memberList.unshift({
                    'Event Name': normalizedEventName,
                    'Team Name': team.teamName,
                    'Member Number': 0,
                    'Member Name': leaderDetails.name,
                    'Member Email': leaderDetails.email,
                    'Member Contact': leaderDetails.contact,
                    'Member University': leaderDetails.university,
                    'Member Role': 'Leader',
                    'Is Leader': 'Yes'
                });
            }
        }

        // Create summary reports
        createCSVReport(individualEventReports, `${outputDir}/all_individual_event_participants.csv`);
        createCSVReport(teamEventReports, `${outputDir}/all_team_event_details.csv`);

        // Create event summary
        const eventSummary = [];

        // Individual events summary
        for (const eventName of individualEvents) {
            const count = individualEventReports.filter(p => p['Event Name'] === eventName).length;
            eventSummary.push({
                'Event Name': eventName,
                'Event Type': 'Individual',
                'Total Participants': count,
                'Total Teams': 0
            });
        }

        // Team events summary
        for (const eventName of teamEventsNormalized) {
            const teams = teamEventReports.filter(t => t['Event Name'] === eventName);
            const totalParticipants = teams.reduce((sum, team) => sum + team['Team Size'], 0);
            eventSummary.push({
                'Event Name': eventName,
                'Event Type': 'Team',
                'Total Participants': totalParticipants,
                'Total Teams': teams.length
            });
        }

        createCSVReport(eventSummary.sort((a, b) => b['Total Participants'] - a['Total Participants']), `${outputDir}/event_summary_report.csv`);

        console.log("\n=== SUMMARY ===");
        console.log(`Individual Events: ${individualEvents.length}`);
        console.log(`Team Events: ${teamEventsNormalized.length}`);
        console.log(`Total Individual Participants: ${individualEventReports.length}`);
        console.log(`Total Team Participants: ${teamEventReports.reduce((sum, team) => sum + team['Team Size'], 0)}`);
        console.log(`Total Teams: ${teamEventReports.length}`);

        console.log("\nFiles created:");
        console.log("1. event_summary_report.csv - Summary of all events with participant/team counts");
        console.log("2. all_individual_event_participants.csv - All individual event participants");
        console.log("3. all_team_event_details.csv - All team details with leaders and members");
        console.log("4. individual_[event]_participants.csv - Separate files for each individual event");
        console.log("5. Excel versions of all reports (.xlsx)");

        // Create Excel versions
        const ws1 = XLSX.utils.json_to_sheet(eventSummary);
        const wb1 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb1, ws1, 'Event Summary');
        XLSX.writeFile(wb1, `${outputDir}/event_summary_report.xlsx`);

        const ws2 = XLSX.utils.json_to_sheet(individualEventReports);
        const wb2 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb2, ws2, 'Individual Participants');
        XLSX.writeFile(wb2, `${outputDir}/all_individual_event_participants.xlsx`);

        const ws3 = XLSX.utils.json_to_sheet(teamEventReports);
        const wb3 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb3, ws3, 'Team Details');
        XLSX.writeFile(wb3, `${outputDir}/all_team_event_details.xlsx`);

    } catch (error) {
        console.error("Error in event participant analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the analysis
analyzeEventParticipants();