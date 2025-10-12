/**
 * Check Unpaid Users Script
 * 
 * This script helps identify users who have created orders but haven't completed payment,
 * and provides methods to query and manage their status.
 */

const mongoose = require('mongoose');
const { Purchase, User } = require('./models/models');

require('dotenv').config();

/**
 * Find all users who have orders but incomplete payments
 */
async function findUnpaidUsers() {
    try {
        console.log('🔍 Searching for users with incomplete payments...');
        
        // Find all purchases with pending payment status
        const unpaidPurchases = await Purchase.find({
            paymentStatus: { $in: ['pending', 'initiated', 'active', 'failed'] }
        }).populate('userId', 'name email contactNo events isvalidated')
          .populate('mainPersonId', 'name email contactNo events isvalidated')
          .sort({ purchaseDate: -1 });
        
        console.log(`📊 Found ${unpaidPurchases.length} unpaid orders`);
        
        const unpaidUsers = [];
        const usersProcessed = new Set(); // To avoid duplicates
        
        for (const purchase of unpaidPurchases) {
            const user = purchase.userId || purchase.mainPersonId;
            const userDetails = purchase.userDetails;
            
            // Use email as unique identifier
            const userEmail = user?.email || userDetails?.email;
            
            if (!userEmail || usersProcessed.has(userEmail)) {
                continue;
            }
            
            usersProcessed.add(userEmail);
            
            const unpaidUser = {
                email: userEmail,
                name: user?.name || userDetails?.name || 'Unknown',
                contactNo: user?.contactNo || userDetails?.contactNo || '',
                orderId: purchase.orderId || purchase.cashfreeOrderId,
                totalAmount: purchase.totalAmount,
                paymentStatus: purchase.paymentStatus,
                orderDate: purchase.purchaseDate,
                events: purchase.items?.map(item => item.itemName).filter(Boolean) || [],
                
                // User status in database
                userExists: !!user,
                userId: user?._id || null,
                isValidated: user?.isvalidated || false,
                hasQR: !!(user?.qrPath || user?.qrCodeBase64),
                
                // Registration status
                userRegistered: purchase.userRegistered || false,
                qrGenerated: purchase.qrGenerated || false,
                emailSent: purchase.emailSent || false,
                
                // Payment details
                cashfreeOrderId: purchase.cashfreeOrderId,
                paymentSessionId: purchase.paymentSessionId
            };
            
            unpaidUsers.push(unpaidUser);
        }
        
        return unpaidUsers;
        
    } catch (error) {
        console.error('❌ Error finding unpaid users:', error);
        return [];
    }
}

/**
 * Display detailed report of unpaid users
 */
async function displayUnpaidUsersReport() {
    try {
        const unpaidUsers = await findUnpaidUsers();
        
        if (unpaidUsers.length === 0) {
            console.log('✅ No unpaid users found - all orders have been completed!');
            return;
        }
        
        console.log('\n📋 UNPAID USERS REPORT');
        console.log('='.repeat(80));
        console.log(`📊 Total unpaid users: ${unpaidUsers.length}`);
        
        // Group by payment status
        const statusGroups = unpaidUsers.reduce((groups, user) => {
            const status = user.paymentStatus || 'unknown';
            if (!groups[status]) groups[status] = [];
            groups[status].push(user);
            return groups;
        }, {});
        
        console.log('\n📈 Breakdown by Payment Status:');
        Object.keys(statusGroups).forEach(status => {
            console.log(`   ${status.toUpperCase()}: ${statusGroups[status].length} users`);
        });
        
        // Calculate total unpaid amount
        const totalUnpaidAmount = unpaidUsers.reduce((total, user) => total + (user.totalAmount || 0), 0);
        console.log(`\n💰 Total Unpaid Amount: ₹${totalUnpaidAmount.toLocaleString()}`);
        
        console.log('\n📝 Detailed User List:');
        console.log('-'.repeat(80));
        
        unpaidUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. ${user.name} (${user.email})`);
            console.log(`   📧 Contact: ${user.contactNo || 'Not provided'}`);
            console.log(`   🆔 Order ID: ${user.orderId}`);
            console.log(`   💰 Amount: ₹${user.totalAmount}`);
            console.log(`   📅 Order Date: ${user.orderDate?.toLocaleDateString() || 'Unknown'}`);
            console.log(`   🎯 Events: ${user.events.length > 0 ? user.events.join(', ') : 'None'}`);
            console.log(`   📊 Payment Status: ${user.paymentStatus?.toUpperCase() || 'UNKNOWN'}`);
            
            // User database status
            console.log(`   👤 User Status:`);
            console.log(`      - Exists in DB: ${user.userExists ? '✅' : '❌'}`);
            console.log(`      - Validated: ${user.isValidated ? '✅' : '❌'}`);
            console.log(`      - Has QR Code: ${user.hasQR ? '✅' : '❌'}`);
            
            // Registration process status
            console.log(`   🔄 Registration Status:`);
            console.log(`      - User Registered: ${user.userRegistered ? '✅' : '❌'}`);
            console.log(`      - QR Generated: ${user.qrGenerated ? '✅' : '❌'}`);
            console.log(`      - Email Sent: ${user.emailSent ? '✅' : '❌'}`);
            
            // Payment gateway details
            if (user.cashfreeOrderId || user.paymentSessionId) {
                console.log(`   💳 Payment Gateway:`);
                if (user.cashfreeOrderId) console.log(`      - Cashfree Order ID: ${user.cashfreeOrderId}`);
                if (user.paymentSessionId) console.log(`      - Payment Session ID: ${user.paymentSessionId}`);
            }
        });
        
        // Security recommendations
        console.log('\n🔒 SECURITY RECOMMENDATIONS:');
        console.log('-'.repeat(50));
        console.log('1. Users with pending payments should NOT have access to:');
        console.log('   - QR code generation or display');
        console.log('   - Event entry or participation');
        console.log('   - Registration confirmation emails');
        console.log('   - User dashboard features');
        
        console.log('\n2. Implement payment verification before:');
        console.log('   - Setting isvalidated = true');
        console.log('   - Generating QR codes');
        console.log('   - Allowing event access');
        console.log('   - Sending confirmation emails');
        
        console.log('\n3. Regular monitoring needed for:');
        console.log('   - Orders stuck in "pending" status');
        console.log('   - Failed payment attempts');
        console.log('   - Users trying to access system without payment');
        
        return unpaidUsers;
        
    } catch (error) {
        console.error('❌ Error displaying report:', error);
        return [];
    }
}

/**
 * Check specific user's payment status
 */
async function checkUserPaymentStatus(email) {
    try {
        console.log(`🔍 Checking payment status for: ${email}`);
        
        // Find user in database
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        
        // Find all purchases for this email
        const purchases = await Purchase.find({
            $or: [
                { 'userDetails.email': email.toLowerCase().trim() },
                { userId: user?._id },
                { mainPersonId: user?._id }
            ]
        }).sort({ purchaseDate: -1 });
        
        console.log('\n📊 User Payment Status Report:');
        console.log('='.repeat(50));
        
        if (user) {
            console.log(`👤 User found in database:`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Validated: ${user.isvalidated ? '✅' : '❌'}`);
            console.log(`   Events: ${user.events?.join(', ') || 'None'}`);
            console.log(`   Has QR: ${!!(user.qrPath || user.qrCodeBase64) ? '✅' : '❌'}`);
        } else {
            console.log(`❌ User not found in database`);
        }
        
        console.log(`\n💳 Purchase History (${purchases.length} orders):`);
        
        if (purchases.length === 0) {
            console.log('   No orders found for this email');
            return { user: null, purchases: [], hasUnpaidOrders: false };
        }
        
        let hasUnpaidOrders = false;
        
        purchases.forEach((purchase, index) => {
            const isPaid = purchase.paymentStatus === 'completed';
            if (!isPaid) hasUnpaidOrders = true;
            
            console.log(`\n   ${index + 1}. Order: ${purchase.orderId}`);
            console.log(`      Amount: ₹${purchase.totalAmount}`);
            console.log(`      Status: ${purchase.paymentStatus?.toUpperCase() || 'PENDING'} ${isPaid ? '✅' : '❌'}`);
            console.log(`      Date: ${purchase.purchaseDate?.toLocaleDateString() || 'Unknown'}`);
            console.log(`      Events: ${purchase.items?.map(item => item.itemName).join(', ') || 'None'}`);
            
            if (!isPaid) {
                console.log(`      ⚠️ UNPAID ORDER - User should not have system access`);
            }
        });
        
        // Security assessment
        console.log(`\n🔒 Security Assessment:`);
        console.log(`   Has Unpaid Orders: ${hasUnpaidOrders ? '❌ YES' : '✅ NO'}`);
        console.log(`   Should Have Access: ${!hasUnpaidOrders ? '✅ YES' : '❌ NO'}`);
        
        if (hasUnpaidOrders && user?.isvalidated) {
            console.log(`   ⚠️ SECURITY ISSUE: User is validated but has unpaid orders!`);
        }
        
        return { user, purchases, hasUnpaidOrders };
        
    } catch (error) {
        console.error('❌ Error checking user payment status:', error);
        return { user: null, purchases: [], hasUnpaidOrders: false };
    }
}

/**
 * Get summary statistics of payment status
 */
async function getPaymentStatusSummary() {
    try {
        console.log('📊 Generating Payment Status Summary...');
        
        // Total users
        const totalUsers = await User.countDocuments();
        
        // Total purchases
        const totalPurchases = await Purchase.countDocuments();
        
        // Purchases by status
        const purchaseStatusCounts = await Purchase.aggregate([
            {
                $group: {
                    _id: '$paymentStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);
        
        // Users with and without QR codes
        const usersWithQR = await User.countDocuments({
            $or: [
                { qrPath: { $exists: true, $ne: '' } },
                { qrCodeBase64: { $exists: true, $ne: '' } }
            ]
        });
        
        const validatedUsers = await User.countDocuments({ isvalidated: true });
        
        console.log('\n📈 PAYMENT STATUS SUMMARY');
        console.log('='.repeat(40));
        console.log(`👥 Total Users: ${totalUsers}`);
        console.log(`📝 Total Orders: ${totalPurchases}`);
        console.log(`✅ Validated Users: ${validatedUsers}`);
        console.log(`🎫 Users with QR: ${usersWithQR}`);
        
        console.log('\n💰 Orders by Payment Status:');
        let totalPaidAmount = 0;
        let totalUnpaidAmount = 0;
        
        purchaseStatusCounts.forEach(status => {
            const statusName = status._id || 'unknown';
            console.log(`   ${statusName.toUpperCase()}: ${status.count} orders (₹${status.totalAmount.toLocaleString()})`);
            
            if (statusName === 'completed') {
                totalPaidAmount += status.totalAmount;
            } else {
                totalUnpaidAmount += status.totalAmount;
            }
        });
        
        console.log(`\n💵 Total Paid: ₹${totalPaidAmount.toLocaleString()}`);
        console.log(`💸 Total Unpaid: ₹${totalUnpaidAmount.toLocaleString()}`);
        
        // Security insights
        const potentialSecurityIssues = await User.countDocuments({
            isvalidated: true,
            $or: [
                { qrPath: { $exists: false } },
                { qrPath: '' },
                { qrCodeBase64: { $exists: false } },
                { qrCodeBase64: '' }
            ]
        });
        
        console.log(`\n🔒 Security Insights:`);
        console.log(`   Validated users without QR: ${potentialSecurityIssues}`);
        
        if (potentialSecurityIssues > 0) {
            console.log(`   ⚠️ These users might have unpaid orders but are marked as validated`);
        }
        
        return {
            totalUsers,
            totalPurchases,
            validatedUsers,
            usersWithQR,
            purchaseStatusCounts,
            totalPaidAmount,
            totalUnpaidAmount,
            potentialSecurityIssues
        };
        
    } catch (error) {
        console.error('❌ Error generating summary:', error);
        return null;
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
        
        console.log('\n🔍 UNPAID USERS ANALYSIS TOOL');
        console.log('=====================================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        
        const args = process.argv.slice(2);
        
        if (args.length > 0) {
            // Check specific user
            const email = args[0];
            await checkUserPaymentStatus(email);
        } else {
            // Full analysis
            await getPaymentStatusSummary();
            console.log('\n');
            await displayUnpaidUsersReport();
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
    findUnpaidUsers,
    displayUnpaidUsersReport,
    checkUserPaymentStatus,
    getPaymentStatusSummary
};

// Run if called directly
if (require.main === module) {
    console.log('🚀 Starting Unpaid Users Analysis...');
    console.log('Usage: node check-unpaid-users.js [email]');
    console.log('       node check-unpaid-users.js (for full report)');
    console.log('       node check-unpaid-users.js user@example.com (for specific user)');
    console.log('');
    
    main();
}