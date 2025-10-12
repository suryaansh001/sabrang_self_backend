/**
 * Script to analyze user validation status in detail
 * Shows breakdown of validation statuses and exports based on different criteria
 */

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');
const { User } = require('./models/models');
require('dotenv').config();

async function analyzeValidationStatus() {
    try {
        console.log('🔍 Starting Detailed User Validation Analysis');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');

        // Get total user count
        const totalUsers = await User.countDocuments({});
        console.log(`📊 Total users in database: ${totalUsers}`);

        // Analyze validation statuses
        console.log('\n🔍 Analyzing validation statuses...');

        // Count by exact validation values
        const validatedTrue = await User.countDocuments({ isvalidated: true });
        const validatedFalse = await User.countDocuments({ isvalidated: false });
        const validatedNull = await User.countDocuments({ isvalidated: null });
        const validatedUndefined = await User.countDocuments({ isvalidated: { $exists: false } });

        console.log('📈 Validation Status Breakdown:');
        console.log(`   ✅ isvalidated: true     = ${validatedTrue} users`);
        console.log(`   ❌ isvalidated: false    = ${validatedFalse} users`);
        console.log(`   ⚪ isvalidated: null     = ${validatedNull} users`);
        console.log(`   ❓ isvalidated: undefined = ${validatedUndefined} users`);

        // Get users with different validation statuses
        const problematicUsers = await User.find({
            $or: [
                { isvalidated: false },
                { isvalidated: null },
                { isvalidated: { $exists: false } }
            ]
        }).sort({ createdAt: -1 });

        console.log(`\n🚨 Users needing attention: ${problematicUsers.length}`);

        if (problematicUsers.length === 0) {
            console.log('🎉 Great! All users have isvalidated: true');
            
            // Let's also check other status fields
            console.log('\n📊 Additional Status Analysis:');
            const usersWithoutQR = await User.countDocuments({ 
                $or: [
                    { qrCodeBase64: { $exists: false } },
                    { qrCodeBase64: null },
                    { qrCodeBase64: "" }
                ]
            });
            console.log(`🔍 Users without QR codes: ${usersWithoutQR}`);

            const usersWithoutEmail = await User.countDocuments({ 
                $or: [
                    { emailSent: { $ne: true } },
                    { emailSent: { $exists: false } }
                ]
            });
            console.log(`📧 Users without emails sent: ${usersWithoutEmail}`);

            const usersNotEntered = await User.countDocuments({ 
                $or: [
                    { hasEntered: { $ne: true } },
                    { hasEntered: { $exists: false } }
                ]
            });
            console.log(`🚪 Users who haven't entered: ${usersNotEntered}`);

            // Create export based on different criteria
            const exportChoice = process.argv[2] || 'qr';
            
            let usersToExport = [];
            let exportTitle = '';
            
            switch (exportChoice) {
                case 'qr':
                    usersToExport = await User.find({
                        $or: [
                            { qrCodeBase64: { $exists: false } },
                            { qrCodeBase64: null },
                            { qrCodeBase64: "" }
                        ]
                    }).sort({ createdAt: -1 });
                    exportTitle = 'Users Without QR Codes';
                    break;
                    
                case 'email':
                    usersToExport = await User.find({
                        $or: [
                            { emailSent: { $ne: true } },
                            { emailSent: { $exists: false } }
                        ]
                    }).sort({ createdAt: -1 });
                    exportTitle = 'Users Without Emails Sent';
                    break;
                    
                case 'entry':
                    usersToExport = await User.find({
                        $or: [
                            { hasEntered: { $ne: true } },
                            { hasEntered: { $exists: false } }
                        ]
                    }).sort({ createdAt: -1 });
                    exportTitle = 'Users Who Haven\'t Entered';
                    break;
                    
                case 'all':
                    usersToExport = await User.find({}).sort({ createdAt: -1 });
                    exportTitle = 'All Users';
                    break;
                    
                default:
                    console.log('❓ No specific export requested. Use: node script.js [qr|email|entry|all]');
                    return;
            }

            if (usersToExport.length > 0) {
                await createExcelExport(usersToExport, exportTitle);
            } else {
                console.log(`✅ No users found matching criteria: ${exportChoice}`);
            }

        } else {
            // Export problematic users
            await createExcelExport(problematicUsers, 'Users with Validation Issues');
        }

        console.log('\n🎉 Analysis completed successfully!');

    } catch (error) {
        console.error('\n❌ Analysis failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('📴 Disconnected from MongoDB');
        }
    }
}

async function createExcelExport(users, title) {
    try {
        console.log(`\n📄 Creating Excel export: ${title}`);
        console.log(`📊 Exporting ${users.length} users...`);

        // Create Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(title);

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
            'Validation Status',
            'Has QR Code',
            'QR Code Length',
            'Email Sent',
            'Email Sent At',
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
            { width: 15 },  // Validation Status
            { width: 12 },  // Has QR Code
            { width: 12 },  // QR Code Length
            { width: 12 },  // Email Sent
            { width: 18 },  // Email Sent At
            { width: 12 },  // Has Entered
            { width: 20 },  // Entry Time
            { width: 18 },  // Created Date
            { width: 18 },  // Updated Date
            { width: 25 }   // User ID
        ];

        // Add data rows
        console.log('📝 Adding user data to Excel...');
        users.forEach((user, index) => {
            const validationStatus = user.isvalidated === true ? 'Validated' : 
                                   user.isvalidated === false ? 'Not Validated' :
                                   user.isvalidated === null ? 'Null' : 'Undefined';

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
                validationStatus,
                user.qrCodeBase64 ? 'Yes' : 'No',
                user.qrCodeBase64 ? user.qrCodeBase64.length : 0,
                user.emailSent ? 'Yes' : 'No',
                user.emailSentAt ? user.emailSentAt.toLocaleString() : '',
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

            // Color coding based on status
            if (user.isvalidated !== true) {
                row.getCell(11).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6' }
                };
            }

            if (!user.qrCodeBase64) {
                row.getCell(12).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6' }
                };
            }

            if (!user.emailSent) {
                row.getCell(14).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9E6' }
                };
            }
        });

        // Add summary
        const summaryRow = worksheet.addRow([]);
        summaryRow.getCell(1).value = 'SUMMARY:';
        summaryRow.getCell(1).font = { bold: true };
        summaryRow.getCell(2).value = `Total Users: ${users.length}`;
        summaryRow.getCell(2).font = { bold: true };

        // Add filters to headers
        worksheet.autoFilter = {
            from: 'A1',
            to: 'T1'
        };

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filename = `${safeTitle}-${timestamp}.xlsx`;
        const filepath = path.join(__dirname, filename);

        // Save the Excel file
        console.log('💾 Saving Excel file...');
        await workbook.xlsx.writeFile(filepath);

        console.log('\n' + '='.repeat(50));
        console.log(`📊 EXCEL EXPORT COMPLETED: ${title}`);
        console.log('='.repeat(50));
        console.log(`✅ Excel file created: ${filename}`);
        console.log(`📁 File location: ${filepath}`);
        console.log(`📋 Total users exported: ${users.length}`);

    } catch (error) {
        console.error('❌ Excel export failed:', error.message);
        throw error;
    }
}

// Handle script interruption
process.on('SIGINT', async () => {
    console.log('\n⚠️  Analysis interrupted by user');
    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
    process.exit(0);
});

// Show usage help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('📋 Usage: node analyze-validation-status.js [export-type]');
    console.log('');
    console.log('Export types:');
    console.log('  qr     - Export users without QR codes');
    console.log('  email  - Export users without emails sent');
    console.log('  entry  - Export users who haven\'t entered');
    console.log('  all    - Export all users');
    console.log('');
    console.log('Examples:');
    console.log('  node analyze-validation-status.js qr');
    console.log('  node analyze-validation-status.js email');
    console.log('  node analyze-validation-status.js all');
    process.exit(0);
}

// Run the analysis
if (require.main === module) {
    analyzeValidationStatus();
}

module.exports = { analyzeValidationStatus, createExcelExport };