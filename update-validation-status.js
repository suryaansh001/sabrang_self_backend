/**
 * Update Validation Status for Matched Emails
 * 
 * This script reads emails from matched_emails_unique.csv and updates their validation status
 * in the database. This is typically used to revoke validation for users who don't have
 * completed payments.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, Purchase } = require('./models/models');
const path = require('path');

require('dotenv').config();

/**
 * Read emails from CSV file
 */
async function readEmailsFromCSV(csvFilePath) {
    return new Promise((resolve, reject) => {
        const emails = [];
        
        if (!fs.existsSync(csvFilePath)) {
            reject(new Error(`CSV file not found: ${csvFilePath}`));
            return;
        }
        
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                // Handle different possible column names
                const email = row.email || row.Email || row.EMAIL || 
                             row['Email Address'] || row['email_address'] ||
                             Object.values(row)[0]; // Take first column if no header match
                
                if (email && email.trim()) {
                    emails.push(email.trim().toLowerCase());
                }
            })
            .on('end', () => {
                console.log(`📧 Read ${emails.length} emails from CSV file`);
                resolve([...new Set(emails)]); // Remove duplicates
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

/**
 * Check if users have completed payments
 */
async function checkUsersPaymentStatus(emails) {
    console.log('🔍 Checking payment status for users...');
    
    const userPaymentStatus = [];
    
    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        
        if (i % 50 === 0) {
            console.log(`   Checking user ${i + 1}/${emails.length}...`);
        }
        
        try {
            // Find user
            const user = await User.findOne({ email: email });
            
            if (!user) {
                userPaymentStatus.push({
                    email,
                    userExists: false,
                    hasCompletedPayment: false,
                    currentlyValidated: false,
                    shouldUpdate: false,
                    reason: 'USER_NOT_FOUND'
                });
                continue;
            }
            
            // Check for completed payments
            const completedPurchases = await Purchase.find({
                $or: [
                    { userId: user._id },
                    { mainPersonId: user._id },
                    { 'userDetails.email': email }
                ],
                paymentStatus: 'completed'
            });
            
            const hasCompletedPayment = completedPurchases.length > 0;
            const currentlyValidated = user.isvalidated || false;
            
            // Determine if we should update
            let shouldUpdate = false;
            let reason = '';
            
            if (currentlyValidated && !hasCompletedPayment) {
                shouldUpdate = true;
                reason = 'VALIDATED_WITHOUT_PAYMENT';
            } else if (currentlyValidated && hasCompletedPayment) {
                shouldUpdate = false;
                reason = 'VALIDATED_WITH_PAYMENT';
            } else if (!currentlyValidated && !hasCompletedPayment) {
                shouldUpdate = false;
                reason = 'ALREADY_UNVALIDATED';
            } else {
                shouldUpdate = false;
                reason = 'UNVALIDATED_WITH_PAYMENT';
            }
            
            userPaymentStatus.push({
                email,
                userId: user._id,
                userName: user.name,
                userExists: true,
                hasCompletedPayment,
                currentlyValidated,
                hasQR: !!(user.qrPath || user.qrCodeBase64),
                completedPurchasesCount: completedPurchases.length,
                events: user.events || [],
                shouldUpdate,
                reason
            });
            
        } catch (error) {
            console.error(`❌ Error checking ${email}:`, error.message);
            userPaymentStatus.push({
                email,
                userExists: false,
                hasCompletedPayment: false,
                currentlyValidated: false,
                shouldUpdate: false,
                reason: 'ERROR_CHECKING',
                error: error.message
            });
        }
    }
    
    return userPaymentStatus;
}

/**
 * Update validation status for users
 */
async function updateValidationStatus(userStatuses, newValidationStatus = false, dryRun = true) {
    const usersToUpdate = userStatuses.filter(user => user.shouldUpdate);
    
    if (usersToUpdate.length === 0) {
        console.log('✅ No users need validation status updates');
        return { updated: 0, errors: [] };
    }
    
    console.log(`\n🔄 ${dryRun ? 'DRY RUN - ' : ''}Updating validation status for ${usersToUpdate.length} users...`);
    console.log(`   Setting isvalidated = ${newValidationStatus}`);
    
    if (dryRun) {
        console.log('\n📋 Users that WOULD be updated:');
        usersToUpdate.forEach((user, index) => {
            console.log(`${index + 1}. ${user.userName} (${user.email})`);
            console.log(`   Reason: ${user.reason}`);
            console.log(`   Currently Validated: ${user.currentlyValidated} → ${newValidationStatus}`);
            console.log(`   Has QR: ${user.hasQR}`);
            console.log(`   Events: ${user.events.join(', ') || 'None'}`);
        });
        
        console.log('\n🔒 DRY RUN MODE - No changes made to database');
        console.log('Set dryRun=false to actually update these users');
        
        return { updated: 0, errors: [], wouldUpdate: usersToUpdate.length };
    }
    
    let updated = 0;
    const errors = [];
    
    for (const user of usersToUpdate) {
        try {
            const updateData = {
                isvalidated: newValidationStatus,
                updatedAt: new Date()
            };
            
            // If removing validation, also remove QR codes and email status
            if (!newValidationStatus) {
                updateData.qrPath = null;
                updateData.qrCodeBase64 = null;
                updateData.emailSent = false;
                updateData.emailSentAt = null;
            }
            
            await User.findByIdAndUpdate(user.userId, updateData);
            
            console.log(`✅ Updated: ${user.userName} (${user.email})`);
            updated++;
            
        } catch (error) {
            console.error(`❌ Error updating ${user.email}:`, error.message);
            errors.push({
                email: user.email,
                error: error.message
            });
        }
    }
    
    return { updated, errors, total: usersToUpdate.length };
}

/**
 * Generate summary report
 */
function generateSummaryReport(userStatuses) {
    console.log('\n📊 VALIDATION STATUS SUMMARY');
    console.log('='.repeat(50));
    
    const summary = userStatuses.reduce((acc, user) => {
        acc.total++;
        
        if (!user.userExists) {
            acc.notFound++;
        } else {
            acc.found++;
            if (user.currentlyValidated) acc.currentlyValidated++;
            if (user.hasCompletedPayment) acc.withPayment++;
            if (user.shouldUpdate) acc.needsUpdate++;
        }
        
        // Count by reason
        if (!acc.reasons[user.reason]) acc.reasons[user.reason] = 0;
        acc.reasons[user.reason]++;
        
        return acc;
    }, {
        total: 0,
        found: 0,
        notFound: 0,
        currentlyValidated: 0,
        withPayment: 0,
        needsUpdate: 0,
        reasons: {}
    });
    
    console.log(`📧 Total Emails Processed: ${summary.total}`);
    console.log(`👤 Users Found: ${summary.found}`);
    console.log(`❌ Users Not Found: ${summary.notFound}`);
    console.log(`✅ Currently Validated: ${summary.currentlyValidated}`);
    console.log(`💳 With Completed Payment: ${summary.withPayment}`);
    console.log(`🔄 Need Update: ${summary.needsUpdate}`);
    
    console.log('\n📈 Breakdown by Status:');
    Object.keys(summary.reasons).forEach(reason => {
        console.log(`   ${reason}: ${summary.reasons[reason]} users`);
    });
    
    return summary;
}

/**
 * Export results to CSV
 */
function exportResultsToCSV(userStatuses) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `validation_status_update_results_${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    // Convert to CSV format
    const headers = [
        'email', 'userName', 'userExists', 'currentlyValidated', 'hasCompletedPayment',
        'hasQR', 'completedPurchasesCount', 'events', 'shouldUpdate', 'reason'
    ];
    
    const csvRows = [headers.join(',')];
    
    userStatuses.forEach(user => {
        const row = [
            user.email,
            user.userName || '',
            user.userExists,
            user.currentlyValidated,
            user.hasCompletedPayment,
            user.hasQR || false,
            user.completedPurchasesCount || 0,
            user.events ? user.events.join('; ') : '',
            user.shouldUpdate,
            user.reason
        ];
        
        csvRows.push(row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(','));
    });
    
    fs.writeFileSync(filepath, csvRows.join('\n'));
    
    console.log(`\n📁 Results exported to: ${filename}`);
    return filepath;
}

/**
 * Main execution function
 */
async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--execute');
        const csvPath = args.find(arg => arg.endsWith('.csv')) || 
                       path.join(__dirname, 'matched_emails_unique.csv');
        
        console.log('🚀 VALIDATION STATUS UPDATE TOOL');
        console.log('='.repeat(40));
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        console.log(`📁 CSV File: ${csvPath}`);
        console.log(`🔄 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE UPDATES'}`);
        
        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');
        
        // Read emails from CSV
        const emails = await readEmailsFromCSV(csvPath);
        console.log(`📧 Processing ${emails.length} unique emails`);
        
        if (emails.length === 0) {
            console.log('❌ No emails found in CSV file');
            return;
        }
        
        // Check payment status for all users
        const userStatuses = await checkUsersPaymentStatus(emails);
        
        // Generate summary report
        const summary = generateSummaryReport(userStatuses);
        
        // Export detailed results
        exportResultsToCSV(userStatuses);
        
        // Update validation status (set to false for users without payment)
        const updateResult = await updateValidationStatus(userStatuses, false, dryRun);
        
        console.log('\n🎉 PROCESS COMPLETED');
        console.log('='.repeat(30));
        
        if (dryRun) {
            console.log(`🔍 DRY RUN RESULTS:`);
            console.log(`   Users that would be updated: ${updateResult.wouldUpdate || 0}`);
            console.log('\n⚠️ To actually update the database, run:');
            console.log(`   node ${path.basename(__filename)} --execute`);
        } else {
            console.log(`✅ ACTUAL UPDATES:`);
            console.log(`   Users updated: ${updateResult.updated}`);
            console.log(`   Errors: ${updateResult.errors.length}`);
            
            if (updateResult.errors.length > 0) {
                console.log('\n❌ Update Errors:');
                updateResult.errors.forEach(error => {
                    console.log(`   ${error.email}: ${error.error}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Script execution failed:', error);
    } finally {
        try {
            await mongoose.disconnect();
            console.log('\n📴 Disconnected from MongoDB');
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError);
        }
    }
}

// Export functions for use in other scripts
module.exports = {
    readEmailsFromCSV,
    checkUsersPaymentStatus,
    updateValidationStatus,
    generateSummaryReport,
    exportResultsToCSV
};

// Run if called directly
if (require.main === module) {
    console.log('📧 Email Validation Status Update Tool');
    console.log('Usage: node update-validation-status.js [options]');
    console.log('       node update-validation-status.js (dry run)');
    console.log('       node update-validation-status.js --execute (actual update)');
    console.log('       node update-validation-status.js custom_emails.csv --execute');
    console.log('');
    console.log('⚠️  WARNING: This will set isvalidated=false for users without completed payments');
    console.log('');
    
    main();
}