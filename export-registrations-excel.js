const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
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

// Function to get individual registrations
async function getIndividualRegistrations() {
    console.log('📊 Fetching individual registrations...');
    
    const users = await User.find({
        isvalidated: true,
        events: { $exists: true, $not: { $size: 0 } }
    }).select('name email contactNo events createdAt updatedAt').lean();
    
    const individualRegistrations = [];
    
    for (const user of users) {
        // Check if this user is part of any team (to avoid double counting)
        const teamCompositions = await TeamComposition.find({
            $or: [
                { 'teamLeader.email': user.email },
                { 'teamMembers.email': user.email }
            ]
        }).lean();
        
        const teamEvents = teamCompositions.map(tc => tc.eventName);
        const individualEvents = (user.events || []).filter(event => !teamEvents.includes(event));
        
        if (individualEvents.length > 0) {
            for (const event of individualEvents) {
                individualRegistrations.push({
                    name: user.name || 'N/A',
                    email: user.email || 'N/A',
                    mobile: user.contactNo || 'N/A',
                    event: event,
                    registrationType: 'Individual',
                    registeredAt: user.createdAt || new Date(),
                    lastUpdated: user.updatedAt || user.createdAt || new Date()
                });
            }
        }
    }
    
    console.log(`✅ Found ${individualRegistrations.length} individual registrations`);
    return individualRegistrations;
}

// Function to get team registrations
async function getTeamRegistrations() {
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
        
        // Add team leader
        if (team.teamLeader && team.teamLeader.userId) {
            teamRegistrations.push({
                name: team.teamLeader.userId.name || team.teamLeader.name || 'N/A',
                email: team.teamLeader.userId.email || team.teamLeader.email || 'N/A',
                mobile: team.teamLeader.userId.contactNo || team.teamLeader.contactNo || 'N/A',
                event: eventName,
                registrationType: 'Team - Leader',
                teamName: teamName,
                teamSize: team.totalMembers || (team.teamMembers.length + 1),
                registeredAt: team.createdAt || new Date(),
                lastUpdated: team.updatedAt || team.createdAt || new Date()
            });
        }
        
        // Add team members
        for (const member of team.teamMembers || []) {
            let memberData = {
                name: 'N/A',
                email: 'N/A',
                mobile: 'N/A'
            };
            
            if (member.userId) {
                memberData = {
                    name: member.userId.name || member.name || 'N/A',
                    email: member.userId.email || member.email || 'N/A',
                    mobile: member.userId.contactNo || member.contactNo || 'N/A'
                };
            } else {
                memberData = {
                    name: member.name || 'N/A',
                    email: member.email || 'N/A',
                    mobile: member.contactNo || 'N/A'
                };
            }
            
            teamRegistrations.push({
                name: memberData.name,
                email: memberData.email,
                mobile: memberData.mobile,
                event: eventName,
                registrationType: 'Team - Member',
                teamName: teamName,
                teamSize: team.totalMembers || (team.teamMembers.length + 1),
                registeredAt: team.createdAt || new Date(),
                lastUpdated: team.updatedAt || team.createdAt || new Date()
            });
        }
    }
    
    console.log(`✅ Found ${teamRegistrations.length} team registrations`);
    return teamRegistrations;
}

// Function to get payment information for enriching data
async function getPaymentInfo() {
    console.log('💳 Fetching payment information...');
    
    const purchases = await Purchase.find({
        paymentStatus: 'completed'
    }).select('userDetails.email orderId totalAmount items paymentCompletedAt').lean();
    
    const paymentMap = new Map();
    
    for (const purchase of purchases) {
        const email = purchase.userDetails?.email;
        if (email) {
            paymentMap.set(email, {
                orderId: purchase.orderId,
                amount: purchase.totalAmount,
                paidAt: purchase.paymentCompletedAt,
                items: purchase.items || []
            });
        }
    }
    
    console.log(`✅ Found payment info for ${paymentMap.size} users`);
    return paymentMap;
}

// Function to create Excel file
async function createExcelReport() {
    console.log('📝 Creating Excel report...');
    
    const workbook = new ExcelJS.Workbook();
    
    // Get all data
    const [individualRegistrations, teamRegistrations, paymentInfo] = await Promise.all([
        getIndividualRegistrations(),
        getTeamRegistrations(),
        getPaymentInfo()
    ]);
    
    // Create Individual Registrations sheet
    const individualSheet = workbook.addWorksheet('Individual Registrations');
    individualSheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Event', key: 'event', width: 30 },
        { header: 'Registration Type', key: 'registrationType', width: 20 },
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Amount Paid', key: 'amountPaid', width: 15 },
        { header: 'Registered At', key: 'registeredAt', width: 20 },
        { header: 'Payment Date', key: 'paymentDate', width: 20 },
        { header: 'Last Updated', key: 'lastUpdated', width: 20 }
    ];
    
    // Add individual registration data
    for (const reg of individualRegistrations) {
        const payment = paymentInfo.get(reg.email);
        individualSheet.addRow({
            name: reg.name,
            email: reg.email,
            mobile: reg.mobile,
            event: reg.event,
            registrationType: reg.registrationType,
            orderId: payment?.orderId || 'N/A',
            amountPaid: payment?.amount || 'N/A',
            registeredAt: reg.registeredAt?.toLocaleDateString() || 'N/A',
            paymentDate: payment?.paidAt?.toLocaleDateString() || 'N/A',
            lastUpdated: reg.lastUpdated?.toLocaleDateString() || 'N/A'
        });
    }
    
    // Create Team Registrations sheet
    const teamSheet = workbook.addWorksheet('Team Registrations');
    teamSheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Event', key: 'event', width: 30 },
        { header: 'Registration Type', key: 'registrationType', width: 20 },
        { header: 'Team Name', key: 'teamName', width: 25 },
        { header: 'Team Size', key: 'teamSize', width: 12 },
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Amount Paid', key: 'amountPaid', width: 15 },
        { header: 'Registered At', key: 'registeredAt', width: 20 },
        { header: 'Payment Date', key: 'paymentDate', width: 20 },
        { header: 'Last Updated', key: 'lastUpdated', width: 20 }
    ];
    
    // Add team registration data
    for (const reg of teamRegistrations) {
        const payment = paymentInfo.get(reg.email);
        teamSheet.addRow({
            name: reg.name,
            email: reg.email,
            mobile: reg.mobile,
            event: reg.event,
            registrationType: reg.registrationType,
            teamName: reg.teamName,
            teamSize: reg.teamSize,
            orderId: payment?.orderId || 'N/A',
            amountPaid: payment?.amount || 'N/A',
            registeredAt: reg.registeredAt?.toLocaleDateString() || 'N/A',
            paymentDate: payment?.paidAt?.toLocaleDateString() || 'N/A',
            lastUpdated: reg.lastUpdated?.toLocaleDateString() || 'N/A'
        });
    }
    
    // Create Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 40 },
        { header: 'Count', key: 'count', width: 15 }
    ];
    
    // Event-wise summary
    const eventSummary = new Map();
    [...individualRegistrations, ...teamRegistrations].forEach(reg => {
        const count = eventSummary.get(reg.event) || 0;
        eventSummary.set(reg.event, count + 1);
    });
    
    summarySheet.addRow({ metric: 'TOTAL REGISTRATIONS', count: individualRegistrations.length + teamRegistrations.length });
    summarySheet.addRow({ metric: 'Individual Registrations', count: individualRegistrations.length });
    summarySheet.addRow({ metric: 'Team Registrations (including leaders)', count: teamRegistrations.length });
    summarySheet.addRow({ metric: '', count: '' }); // Empty row
    summarySheet.addRow({ metric: 'EVENT-WISE BREAKDOWN', count: '' });
    
    for (const [event, count] of eventSummary.entries()) {
        summarySheet.addRow({ metric: event, count: count });
    }
    
    // Style the headers
    [individualSheet, teamSheet, summarySheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
    });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sabrang_registrations_${timestamp}.xlsx`;
    const filepath = path.join(__dirname, filename);
    
    // Save the file
    await workbook.xlsx.writeFile(filepath);
    
    console.log(`✅ Excel report created: ${filename}`);
    console.log(`📁 File saved at: ${filepath}`);
    
    return {
        filename,
        filepath,
        stats: {
            totalRegistrations: individualRegistrations.length + teamRegistrations.length,
            individualRegistrations: individualRegistrations.length,
            teamRegistrations: teamRegistrations.length,
            events: eventSummary.size
        }
    };
}

// Function to display summary statistics
function displaySummary(stats) {
    console.log('\n📊 REGISTRATION SUMMARY');
    console.log('========================');
    console.log(`Total Registrations: ${stats.totalRegistrations}`);
    console.log(`Individual Registrations: ${stats.individualRegistrations}`);
    console.log(`Team Registrations: ${stats.teamRegistrations}`);
    console.log(`Total Events: ${stats.events}`);
    console.log('========================\n');
}

// Main function
async function generateRegistrationReport() {
    try {
        console.log('🚀 Starting Registration Excel Export...\n');
        
        // Connect to database
        await connectDB();
        
        // Create Excel report
        const result = await createExcelReport();
        
        // Display summary
        displaySummary(result.stats);
        
        console.log('✅ Registration export completed successfully!');
        console.log(`📄 Open file: ${result.filename}`);
        
    } catch (error) {
        console.error('❌ Error generating registration report:', error);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Install exceljs if not already installed
async function checkAndInstallDependencies() {
    try {
        require('exceljs');
        console.log('✅ ExcelJS dependency found');
    } catch (error) {
        console.log('📦 Installing ExcelJS dependency...');
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
            exec('npm install exceljs', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Failed to install ExcelJS:', error);
                    reject(error);
                } else {
                    console.log('✅ ExcelJS installed successfully');
                    resolve();
                }
            });
        });
    }
}

// Run the script
if (require.main === module) {
    checkAndInstallDependencies()
        .then(() => generateRegistrationReport())
        .catch(console.error);
}

module.exports = {
    generateRegistrationReport,
    getIndividualRegistrations,
    getTeamRegistrations,
    createExcelReport
};