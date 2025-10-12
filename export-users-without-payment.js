/**
 * Export Users Without Payment to CSV
 * 
 * This script finds users who exist in the users collection but don't have completed payments
 * and exports them to a CSV file for analysis and follow-up actions.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const { Purchase, User } = require('./models/models');
const path = require('path');

require('dotenv').config();

/**
 * Find users who exist in the database but don't have completed payments
 */
async function findUsersWithoutPayment() {
    try {
        console.log('🔍 Searching for users without completed payments...');
        
        // Get all users from the database
        const allUsers = await User.find({}).sort({ createdAt: -1 });
        console.log(`📊 Found ${allUsers.length} total users in database`);
        
        const usersWithoutPayment = [];
        let processedCount = 0;
        
        for (const user of allUsers) {
            processedCount++;
            
            // Show progress for large datasets
            if (processedCount % 100 === 0) {
                console.log(`   Processing user ${processedCount}/${allUsers.length}...`);
            }
            
            // Find all purchases for this user
            const purchases = await Purchase.find({
                $or: [
                    { userId: user._id },
                    { mainPersonId: user._id },
                    { 'userDetails.email': user.email.toLowerCase().trim() }
                ]
            });
            
            // Check if user has any completed payments
            const completedPurchases = purchases.filter(p => p.paymentStatus === 'completed');
            const pendingPurchases = purchases.filter(p => p.paymentStatus !== 'completed');
            
            // If user has no completed payments, add to list
            if (completedPurchases.length === 0) {
                const userWithoutPayment = {
                    userId: user._id.toString(),
                    name: user.name || '',
                    email: user.email || '',
                    contactNo: user.contactNo || '',
                    gender: user.gender || '',
                    age: user.age || '',
                    universityName: user.universityName || '',
                    address: user.address || '',
                    events: user.events ? user.events.join('; ') : '',
                    userType: user.userType || 'participant',
                    isValidated: user.isvalidated || false,
                    hasQR: !!(user.qrPath || user.qrCodeBase64),
                    createdAt: user.createdAt ? user.createdAt.toISOString() : '',
                    
                    // Payment information
                    totalOrders: purchases.length,
                    completedOrders: completedPurchases.length,
                    pendingOrders: pendingPurchases.length,
                    
                    // Order details
                    orderIds: purchases.map(p => p.orderId || p.cashfreeOrderId).filter(Boolean).join('; '),
                    totalOrderAmount: purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
                    paymentStatuses: purchases.map(p => p.paymentStatus || 'unknown').join('; '),
                    orderDates: purchases.map(p => p.purchaseDate ? p.purchaseDate.toISOString().split('T')[0] : '').filter(Boolean).join('; '),
                    
                    // Registration status
                    userRegistered: purchases.some(p => p.userRegistered === true),
                    qrGenerated: purchases.some(p => p.qrGenerated === true),
                    emailSent: purchases.some(p => p.emailSent === true) || user.emailSent || false,
                    
                    // Security assessment
                    securityIssue: (user.isvalidated && purchases.length === 0) ? 'VALIDATED_NO_ORDERS' :
                                  (user.isvalidated && completedPurchases.length === 0) ? 'VALIDATED_NO_PAYMENT' :
                                  purchases.length === 0 ? 'NO_ORDERS' : 'UNPAID_ORDERS',
                    
                    // Team information
                    teamRegistrations: user.teamRegistrations ? user.teamRegistrations.length : 0,
                    
                    // Additional metadata
                    profileImage: user.profileImage ? 'YES' : 'NO',
                    universityIdCard: user.universityIdCard ? 'YES' : 'NO',
                    referralCode: user.referralCode || '',
                    supportRole: user.supportRole || '',
                    governmentId: user.governmentId || '',
                    visitorPassDays: user.visitorPassDays || 0
                };
                
                usersWithoutPayment.push(userWithoutPayment);
            }
        }
        
        console.log(`📊 Found ${usersWithoutPayment.length} users without completed payments`);
        return usersWithoutPayment;
        
    } catch (error) {
        console.error('❌ Error finding users without payment:', error);
        return [];
    }
}

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data) {
    if (data.length === 0) {
        return '';
    }
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV header row
    const csvHeaders = headers.join(',');
    
    // Create CSV data rows
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas, quotes, or newlines
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Export users without payment to CSV file
 */
async function exportUsersWithoutPaymentToCSV() {
    try {
        console.log('🚀 Starting export of users without payment...');
        
        // Find users without payment
        const usersWithoutPayment = await findUsersWithoutPayment();
        
        if (usersWithoutPayment.length === 0) {
            console.log('✅ No users without payment found - all users have completed payments!');
            return null;
        }
        
        // Generate CSV content
        console.log('📝 Converting data to CSV format...');
        const csvContent = convertToCSV(usersWithoutPayment);
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `users_without_payment_${timestamp}.csv`;
        const filepath = path.join(__dirname, filename);
        
        // Write CSV file
        console.log(`💾 Writing CSV file: ${filename}`);
        fs.writeFileSync(filepath, csvContent);
        
        console.log('\n🎉 Export completed successfully!');
        console.log('='.repeat(50));
        console.log(`📁 File saved: ${filepath}`);
        console.log(`📊 Total records: ${usersWithoutPayment.length}`);
        console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
        
        // Generate summary statistics
        const securityIssues = usersWithoutPayment.reduce((groups, user) => {
            const issue = user.securityIssue;
            if (!groups[issue]) groups[issue] = 0;
            groups[issue]++;
            return groups;
        }, {});
        
        console.log('\n📈 Security Issues Breakdown:');
        Object.keys(securityIssues).forEach(issue => {
            console.log(`   ${issue}: ${securityIssues[issue]} users`);
        });
        
        // Calculate total unpaid amount
        const totalUnpaidAmount = usersWithoutPayment.reduce((sum, user) => sum + user.totalOrderAmount, 0);
        console.log(`\n💰 Total Unpaid Amount: ₹${totalUnpaidAmount.toLocaleString()}`);
        
        // High priority users (validated but no payment)
        const highPriorityUsers = usersWithoutPayment.filter(user => 
            user.securityIssue === 'VALIDATED_NO_PAYMENT' || user.securityIssue === 'VALIDATED_NO_ORDERS'
        );
        
        if (highPriorityUsers.length > 0) {
            console.log(`\n⚠️ HIGH PRIORITY SECURITY ISSUES: ${highPriorityUsers.length} users`);
            console.log('   These users are marked as validated but have no completed payments!');
            
            // Create separate file for high priority users
            const highPriorityCSV = convertToCSV(highPriorityUsers);
            const highPriorityFilename = `high_priority_security_issues_${timestamp}.csv`;
            const highPriorityFilepath = path.join(__dirname, highPriorityFilename);
            fs.writeFileSync(highPriorityFilepath, highPriorityCSV);
            console.log(`   Separate file created: ${highPriorityFilename}`);
        }
        
        console.log('\n📋 CSV Columns Included:');
        const sampleUser = usersWithoutPayment[0];
        Object.keys(sampleUser).forEach((column, index) => {
            console.log(`   ${index + 1}. ${column}`);
        });
        
        console.log('\n💡 Next Steps:');
        console.log('1. Review the CSV file to identify users who need follow-up');
        console.log('2. Contact users with pending orders to complete payment');
        console.log('3. Fix security issues (validated users without payment)');
        console.log('4. Consider implementing payment verification middleware');
        
        return {
            filename,
            filepath,
            totalRecords: usersWithoutPayment.length,
            highPriorityUsers: highPriorityUsers.length,
            totalUnpaidAmount,
            securityIssues
        };
        
    } catch (error) {
        console.error('❌ Error exporting users without payment:', error);
        return null;
    }
}

/**
 * Generate detailed analysis report
 */
async function generateAnalysisReport() {
    try {
        console.log('📊 Generating detailed analysis report...');
        
        const usersWithoutPayment = await findUsersWithoutPayment();
        
        if (usersWithoutPayment.length === 0) {
            console.log('✅ No analysis needed - all users have completed payments!');
            return;
        }
        
        console.log('\n📋 DETAILED ANALYSIS REPORT');
        console.log('='.repeat(60));
        
        // Group by university
        const usersByUniversity = usersWithoutPayment.reduce((groups, user) => {
            const uni = user.universityName || 'Not Specified';
            if (!groups[uni]) groups[uni] = [];
            groups[uni].push(user);
            return groups;
        }, {});
        
        console.log('\n🏫 Users by University:');
        Object.keys(usersByUniversity).sort().forEach(uni => {
            console.log(`   ${uni}: ${usersByUniversity[uni].length} users`);
        });
        
        // Group by events
        const usersByEvents = usersWithoutPayment.reduce((groups, user) => {
            const events = user.events || 'No Events';
            if (!groups[events]) groups[events] = 0;
            groups[events]++;
            return groups;
        }, {});
        
        console.log('\n🎯 Users by Events:');
        Object.keys(usersByEvents).slice(0, 10).forEach(events => {
            console.log(`   ${events}: ${usersByEvents[events]} users`);
        });
        
        // Recent registrations without payment
        const recentUsers = usersWithoutPayment.filter(user => {
            if (!user.createdAt) return false;
            const createdDate = new Date(user.createdAt);
            const daysSinceCreation = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
            return daysSinceCreation <= 7;
        });
        
        console.log(`\n📅 Recent Registrations (Last 7 days): ${recentUsers.length} users`);
        
        // Users with multiple pending orders
        const usersWithMultipleOrders = usersWithoutPayment.filter(user => user.pendingOrders > 1);
        console.log(`\n📝 Users with Multiple Pending Orders: ${usersWithMultipleOrders.length} users`);
        
        return usersWithoutPayment;
        
    } catch (error) {
        console.error('❌ Error generating analysis report:', error);
        return [];
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        // Connect to database
        await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
        console.log('✅ Connected to MongoDB');
        
        console.log('\n📤 USERS WITHOUT PAYMENT EXPORT TOOL');
        console.log('====================================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        
        const args = process.argv.slice(2);
        
        if (args.includes('--analysis') || args.includes('-a')) {
            // Generate detailed analysis
            await generateAnalysisReport();
        } else {
            // Export to CSV (default)
            const result = await exportUsersWithoutPaymentToCSV();
            
            if (result) {
                console.log(`\n✅ Export completed: ${result.filename}`);
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
    findUsersWithoutPayment,
    exportUsersWithoutPaymentToCSV,
    generateAnalysisReport,
    convertToCSV
};

// Run if called directly
if (require.main === module) {
    console.log('🚀 Starting Users Without Payment Export...');
    console.log('Usage: node export-users-without-payment.js [options]');
    console.log('       node export-users-without-payment.js (export to CSV)');
    console.log('       node export-users-without-payment.js --analysis (detailed analysis)');
    console.log('');
    
    main();
}