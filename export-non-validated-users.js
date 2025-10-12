/**
 * Script to export all non-validated users to Excel
 * Creates an Excel file with users who have isvalidated: false
 */

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');
const { User, TeamComposition } = require('./models/models');
require('dotenv').config();

async function exportNonValidatedUsers() {
    try {
        console.log('🚀 Starting Non-Validated Users Export');
        console.log('=' .repeat(50));

        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        // Get all non-validated users
        console.log('📊 Fetching non-validated users...');
        const nonValidatedUsers = await User.find({ 
            isvalidated: { $ne: true } // Not validated or validation field is missing
        }).sort({ createdAt: -1 });

        console.log(`📋 Found ${nonValidatedUsers.length} non-validated users`);

        if (nonValidatedUsers.length === 0) {
            console.log('🎉 Great! All users are validated!');
            return;
        }

        // Create Excel workbook and worksheet
        console.log('📄 Creating Excel file...');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Non-Validated Users');

        // Set up headers with styling
        const headers = [
            'S.No.',
            'Name',
            'Email',
            'Contact Number',
            'Gender',
            'Age',
            'University',
            'Address',
            'Events',
            'User Type',
            'Has QR Code',
            'Email Sent',
            'Has Entered',
            'Entry Time',
            'Created Date',
            'Updated Date',
            'User ID'
        ];

        // Add headers with styling
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '366092' }
        };

        // Set column widths
        worksheet.columns = [
            { width: 8 },   // S.No.
            { width: 25 },  // Name
            { width: 35 },  // Email
            { width: 15 },  // Contact
            { width: 10 },  // Gender
            { width: 8 },   // Age
            { width: 30 },  // University
            { width: 40 },  // Address
            { width: 30 },  // Events
            { width: 15 },  // User Type
            { width: 12 },  // Has QR Code
            { width: 12 },  // Email Sent
            { width: 12 },  // Has Entered
            { width: 20 },  // Entry Time
            { width: 18 },  // Created Date
            { width: 18 },  // Updated Date
            { width: 25 }   // User ID
        ];

        // Add data rows
        console.log('📝 Adding user data to Excel...');
        nonValidatedUsers.forEach((user, index) => {
            const row = worksheet.addRow([
                index + 1,
                user.name || '',
                user.email || '',
                user.contactNo || '',
                user.gender || '',
                user.age || '',
                user.universityName || '',
                user.address || '',
                Array.isArray(user.events) ? user.events.join(', ') : '',
                user.userType || 'participant',
                user.qrCodeBase64 ? 'Yes' : 'No',
                user.emailSent ? 'Yes' : 'No',
                user.hasEntered ? 'Yes' : 'No',
                user.entryTime ? user.entryTime.toLocaleString() : '',
                user.createdAt ? user.createdAt.toLocaleString() : '',
                user.updatedAt ? user.updatedAt.toLocaleString() : '',
                user._id.toString()
            ]);

            // Alternate row colors for better readability
            if (index % 2 === 1) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F8F9FA' }
                };
            }

            // Highlight users without QR codes in light red
            if (!user.qrCodeBase64) {
                row.getCell(11).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6' }
                };
            }

            // Highlight users without emails sent in light yellow
            if (!user.emailSent) {
                row.getCell(12).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9E6' }
                };
            }
        });

        // Add summary row
        const summaryRow = worksheet.addRow([]);
        summaryRow.getCell(1).value = 'SUMMARY:';
        summaryRow.getCell(1).font = { bold: true };
        summaryRow.getCell(2).value = `Total Non-Validated Users: ${nonValidatedUsers.length}`;
        summaryRow.getCell(2).font = { bold: true };

        // Count users without QR codes
        const usersWithoutQR = nonValidatedUsers.filter(user => !user.qrCodeBase64).length;
        const summaryRow2 = worksheet.addRow([]);
        summaryRow2.getCell(2).value = `Users without QR Code: ${usersWithoutQR}`;
        summaryRow2.getCell(2).font = { color: { argb: 'FF0000' } };

        // Count users without emails sent
        const usersWithoutEmail = nonValidatedUsers.filter(user => !user.emailSent).length;
        const summaryRow3 = worksheet.addRow([]);
        summaryRow3.getCell(2).value = `Users without Email Sent: ${usersWithoutEmail}`;
        summaryRow3.getCell(2).font = { color: { argb: 'FF8C00' } };

        // Add filters to headers
        worksheet.autoFilter = {
            from: 'A1',
            to: `Q1`
        };

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `non-validated-users-${timestamp}.xlsx`;
        const filepath = path.join(__dirname, filename);

        // Save the Excel file
        console.log('💾 Saving Excel file...');
        await workbook.xlsx.writeFile(filepath);

        console.log('\n' + '='.repeat(50));
        console.log('📊 NON-VALIDATED USERS EXPORT COMPLETED');
        console.log('='.repeat(50));
        console.log(`✅ Excel file created: ${filename}`);
        console.log(`📁 File location: ${filepath}`);
        console.log(`📋 Total non-validated users: ${nonValidatedUsers.length}`);
        console.log(`🔍 Users without QR codes: ${usersWithoutQR}`);
        console.log(`📧 Users without emails sent: ${usersWithoutEmail}`);

        // Show breakdown by user type
        const userTypeBreakdown = {};
        nonValidatedUsers.forEach(user => {
            const userType = user.userType || 'participant';
            userTypeBreakdown[userType] = (userTypeBreakdown[userType] || 0) + 1;
        });

        console.log('\n📊 Breakdown by User Type:');
        Object.entries(userTypeBreakdown).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} users`);
        });

        // Show breakdown by events
        const eventBreakdown = {};
        nonValidatedUsers.forEach(user => {
            if (Array.isArray(user.events)) {
                user.events.forEach(event => {
                    eventBreakdown[event] = (eventBreakdown[event] || 0) + 1;
                });
            }
        });

        if (Object.keys(eventBreakdown).length > 0) {
            console.log('\n🎭 Breakdown by Events:');
            Object.entries(eventBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10) // Top 10 events
                .forEach(([event, count]) => {
                    console.log(`   ${event}: ${count} users`);
                });
        }

        // Show recent registrations (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentNonValidated = nonValidatedUsers.filter(user => 
            user.createdAt && user.createdAt > sevenDaysAgo
        ).length;

        console.log(`\n📅 Non-validated users registered in last 7 days: ${recentNonValidated}`);

        console.log('\n🎉 Export completed successfully!');

    } catch (error) {
        console.error('\n❌ Export failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('📴 Disconnected from MongoDB');
        }
    }
}

// Handle script interruption
process.on('SIGINT', async () => {
    console.log('\n⚠️  Export interrupted by user');
    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
    process.exit(0);
});

// Run the export
if (require.main === module) {
    exportNonValidatedUsers();
}

module.exports = { exportNonValidatedUsers };