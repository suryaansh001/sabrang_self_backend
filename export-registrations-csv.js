const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import models
const { User, TeamComposition, Purchase } = require('./models/models');

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.mongodb, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Database Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    }
}

// Function to escape CSV fields
function escapeCSV(field) {
    if (!field) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Function to create CSV content
function arrayToCSV(data, headers) {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
        headers.map(header => escapeCSV(row[header])).join(',')
    );
    return [csvHeaders, ...csvRows].join('\n');
}

// Main export function
async function exportRegistrationsToCSV() {
    console.log('🚀 Starting Registration CSV Export...\n');
    
    try {
        await connectDB();
        
        // Get all individual registrations
        console.log('📊 Fetching individual registrations...');
        const users = await User.find({
            isvalidated: true,
            events: { $exists: true, $not: { $size: 0 } }
        }).select('name email contactNo events createdAt').lean();
        
        const individualRegistrations = [];
        for (const user of users) {
            for (const event of user.events || []) {
                individualRegistrations.push({
                    name: user.name || 'N/A',
                    email: user.email || 'N/A',
                    mobile: user.contactNo || 'N/A',
                    event: event,
                    type: 'Individual',
                    teamName: '',
                    teamSize: '1',
                    registeredAt: user.createdAt?.toLocaleDateString() || 'N/A'
                });
            }
        }
        
        // Get all team registrations
        console.log('👥 Fetching team registrations...');
        const teamCompositions = await TeamComposition.find({
            registrationComplete: true
        }).populate('teamLeader.userId', 'name email contactNo')
          .populate('teamMembers.userId', 'name email contactNo')
          .lean();
        
        const teamRegistrations = [];
        for (const team of teamCompositions) {
            const eventName = team.eventName || 'Unknown Event';
            const teamName = team.teamName || 'Unnamed Team';
            const teamSize = team.totalMembers || (team.teamMembers.length + 1);
            
            // Add team leader
            if (team.teamLeader) {
                const leader = team.teamLeader.userId || team.teamLeader;
                teamRegistrations.push({
                    name: leader.name || 'N/A',
                    email: leader.email || 'N/A',
                    mobile: leader.contactNo || 'N/A',
                    event: eventName,
                    type: 'Team Leader',
                    teamName: teamName,
                    teamSize: teamSize.toString(),
                    registeredAt: team.createdAt?.toLocaleDateString() || 'N/A'
                });
            }
            
            // Add team members
            for (const member of team.teamMembers || []) {
                const memberData = member.userId || member;
                teamRegistrations.push({
                    name: memberData.name || 'N/A',
                    email: memberData.email || 'N/A',
                    mobile: memberData.contactNo || 'N/A',
                    event: eventName,
                    type: 'Team Member',
                    teamName: teamName,
                    teamSize: teamSize.toString(),
                    registeredAt: team.createdAt?.toLocaleDateString() || 'N/A'
                });
            }
        }
        
        // Combine all registrations
        const allRegistrations = [...individualRegistrations, ...teamRegistrations];
        
        // Create CSV content
        const headers = ['name', 'email', 'mobile', 'event', 'type', 'teamName', 'teamSize', 'registeredAt'];
        const csvContent = arrayToCSV(allRegistrations, headers);
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `sabrang_registrations_${timestamp}.csv`;
        const filepath = path.join(__dirname, filename);
        
        // Save the file
        fs.writeFileSync(filepath, csvContent, 'utf8');
        
        // Create summary
        const eventSummary = {};
        allRegistrations.forEach(reg => {
            eventSummary[reg.event] = (eventSummary[reg.event] || 0) + 1;
        });
        
        // Display results
        console.log(`✅ CSV file created: ${filename}`);
        console.log(`📁 File saved at: ${filepath}`);
        console.log('\n📊 REGISTRATION SUMMARY');
        console.log('========================');
        console.log(`Total Registrations: ${allRegistrations.length}`);
        console.log(`Individual Registrations: ${individualRegistrations.length}`);
        console.log(`Team Registrations: ${teamRegistrations.length}`);
        console.log('\n📋 EVENT-WISE BREAKDOWN:');
        Object.entries(eventSummary).sort(([,a], [,b]) => b - a).forEach(([event, count]) => {
            console.log(`  ${event}: ${count}`);
        });
        console.log('========================\n');
        
        return {
            filename,
            filepath,
            totalRegistrations: allRegistrations.length,
            individualCount: individualRegistrations.length,
            teamCount: teamRegistrations.length
        };
        
    } catch (error) {
        console.error('❌ Error exporting registrations:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    exportRegistrationsToCSV()
        .then(() => {
            console.log('✅ Export completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Export failed:', error);
            process.exit(1);
        });
}

module.exports = { exportRegistrationsToCSV };