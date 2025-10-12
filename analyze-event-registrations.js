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

// Main function to analyze event registrations
async function analyzeEventRegistrations() {
    try {
        await connectToMongoDB();

        console.log("=== ANALYZING EVENT REGISTRATIONS ===");

        // Get all users from main Users collection
        const allUsers = await User.find({});
        console.log(`Total Users in main collection: ${allUsers.length}`);

        // Get all users from UpdatedUser collection
        const updatedUsers = await UpdatedUser.find({});
        console.log(`Total Users in UpdatedUser collection: ${updatedUsers.length}`);

        // Combine all users
        const allUsersCombined = [...allUsers, ...updatedUsers];
        console.log(`Total combined users: ${allUsersCombined.length}`);

        // Collect all unique events and count registrations
        const eventStats = {};
        let totalRegistrations = 0;

        for (const user of allUsersCombined) {
            if (user.events && Array.isArray(user.events)) {
                totalRegistrations += user.events.length;

                // Count unique users per event
                const uniqueEvents = [...new Set(user.events)]; // Remove duplicates in user's events array if any

                for (const event of uniqueEvents) {
                    if (!eventStats[event]) {
                        eventStats[event] = {
                            uniqueUsers: 0,
                            totalRegistrations: 0
                        };
                    }
                    eventStats[event].uniqueUsers++;
                }

                // Count total registrations (including multiples if user has same event multiple times, though unlikely)
                for (const event of user.events) {
                    eventStats[event].totalRegistrations++;
                }
            }
        }

        // Create report data
        const eventReportData = Object.entries(eventStats)
            .map(([event, stats]) => ({
                'Event Name': event,
                'Unique Users': stats.uniqueUsers,
                'Total Registrations': stats.totalRegistrations
            }))
            .sort((a, b) => b['Unique Users'] - a['Unique Users']); // Sort by unique users descending

        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Create CSV file
        createCSVReport(eventReportData, `${outputDir}/event_wise_registrations.csv`);

        // Also create Excel for completeness
        const ws = XLSX.utils.json_to_sheet(eventReportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Event Registrations');
        XLSX.writeFile(wb, `${outputDir}/event_wise_registrations.xlsx`);
        console.log(`Excel file created: ${outputDir}/event_wise_registrations.xlsx`);

        // Print summary
        console.log("\n=== EVENT REGISTRATION SUMMARY ===");
        console.log(`Total Users Analyzed: ${allUsersCombined.length}`);
        console.log(`Total Event Registrations: ${totalRegistrations}`);
        console.log(`Unique Events: ${Object.keys(eventStats).length}`);

        console.log("\n=== TOP 10 EVENTS BY UNIQUE USERS ===");
        eventReportData.slice(0, 10).forEach((event, index) => {
            console.log(`${index + 1}. ${event['Event Name']}: ${event['Unique Users']} users (${event['Total Registrations']} registrations)`);
        });

        console.log("\n=== ALL EVENTS ===");
        eventReportData.forEach(event => {
            console.log(`${event['Event Name']}: ${event['Unique Users']} users`);
        });

        console.log("\nFiles created:");
        console.log("1. event_wise_registrations.csv - Event-wise registration counts");
        console.log("2. event_wise_registrations.xlsx - Same data in Excel format");

    } catch (error) {
        console.error("Error in event registration analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the analysis
analyzeEventRegistrations();