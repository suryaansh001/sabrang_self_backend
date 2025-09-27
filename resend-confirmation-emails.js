#!/usr/bin/env node

/**
 * Admin Script: Resend Confirmation Emails
 * 
 * This script allows admins to resend confirmation emails to users who have completed payments
 * but may not have received their confirmation emails initially.
 * 
 * Usage:
 * node resend-confirmation-emails.js --email user@example.com
 * node resend-confirmation-emails.js --user-id 507f1f77bcf86cd799439011
 * node resend-confirmation-emails.js --order-id order_123456789
 * node resend-confirmation-emails.js --batch --status completed --limit 10
 * node resend-confirmation-emails.js --batch --no-email-sent --limit 5
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Purchase, TeamComposition } = require('./models/models');
const { sendRegistrationEmail } = require('./utils/emailService');

// Command line argument parsing
const args = process.argv.slice(2);
const getArgValue = (arg) => {
    const index = args.indexOf(arg);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
};
const hasArg = (arg) => args.includes(arg);

// Configuration
const config = {
    email: getArgValue('--email'),
    userId: getArgValue('--user-id'),
    orderId: getArgValue('--order-id'),
    batch: hasArg('--batch'),
    status: getArgValue('--status') || 'completed',
    limit: parseInt(getArgValue('--limit')) || 10,
    noEmailSent: hasArg('--no-email-sent'),
    dryRun: hasArg('--dry-run'),
    force: hasArg('--force')
};

// Connect to database
async function connectDB() {
    try {
        const mongoUri = process.env.DATABASE_URL || process.env.mongodb;
        if (!mongoUri) {
            throw new Error('DATABASE_URL or mongodb environment variable is required');
        }
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

// Find user by different criteria
async function findUser() {
    let user = null;
    
    if (config.email) {
        console.log(`🔍 Finding user by email: ${config.email}`);
        user = await User.findOne({ email: config.email });
    } else if (config.userId) {
        console.log(`🔍 Finding user by ID: ${config.userId}`);
        user = await User.findById(config.userId);
    } else if (config.orderId) {
        console.log(`🔍 Finding user by order ID: ${config.orderId}`);
        const purchase = await Purchase.findOne({ orderId: config.orderId });
        if (purchase && purchase.userId) {
            user = await User.findById(purchase.userId);
        } else if (purchase && purchase.userDetails && purchase.userDetails.email) {
            user = await User.findOne({ email: purchase.userDetails.email });
        }
    }
    
    return user;
}

// Find users for batch processing
async function findBatchUsers() {
    console.log(`🔍 Finding users for batch processing...`);
    
    let query = {};
    
    // Filter by payment status if specified
    if (config.status === 'completed') {
        // Find users who have completed purchases
        const completedPurchases = await Purchase.find({ paymentStatus: 'completed' }).select('userId userDetails.email');
        const userIds = completedPurchases.map(p => p.userId).filter(Boolean);
        const emails = completedPurchases.map(p => p.userDetails?.email).filter(Boolean);
        
        query = {
            $or: [
                { _id: { $in: userIds } },
                { email: { $in: emails } }
            ]
        };
    }
    
    // Filter by email sent status
    if (config.noEmailSent) {
        query.emailSent = { $ne: true };
    }
    
    const users = await User.find(query).limit(config.limit);
    console.log(`📊 Found ${users.length} users for batch processing`);
    
    return users;
}

// Get user's event information
async function getUserEvents(user) {
    let events = user.events || [];
    
    // If no events in user record, try to get from purchases
    if (events.length === 0) {
        const purchases = await Purchase.find({
            $or: [
                { userId: user._id },
                { 'userDetails.email': user.email }
            ],
            paymentStatus: 'completed'
        });
        
        // Extract events from purchases
        for (const purchase of purchases) {
            if (purchase.items && purchase.items.length > 0) {
                const purchaseEvents = purchase.items.map(item => item.itemName || item.eventName).filter(Boolean);
                events = [...events, ...purchaseEvents];
            }
        }
    }
    
    // If still no events, try to get from team compositions
    if (events.length === 0) {
        const teamComps = await TeamComposition.find({
            $or: [
                { 'teamLeader.email': user.email },
                { 'teamMembers.email': user.email }
            ],
            paymentStatus: 'completed'
        });
        
        events = teamComps.map(tc => tc.eventName).filter(Boolean);
    }
    
    // Default events if none found
    if (events.length === 0) {
        events = ['Sabrang\'25 Event'];
    }
    
    // Remove duplicates
    return [...new Set(events)];
}

// Resend email for a single user
async function resendEmailForUser(user) {
    try {
        console.log(`📧 Preparing to resend email for: ${user.name} (${user.email})`);
        
        // Check if user has QR code
        if (!user.qrCodeBase64) {
            console.warn(`⚠️ User ${user.email} doesn't have a QR code. Skipping.`);
            return { success: false, reason: 'No QR code available' };
        }
        
        // Get user's events
        const events = await getUserEvents(user);
        
        // Prepare email data
        const emailData = {
            name: user.name,
            email: user.email,
            events: events,
            qrCodeBase64: user.qrCodeBase64
        };
        
        if (config.dryRun) {
            console.log(`🧪 DRY RUN: Would send email to ${user.email} with events: ${events.join(', ')}`);
            return { success: true, reason: 'Dry run - no actual email sent' };
        }
        
        // Send the email
        const result = await sendRegistrationEmail(user.email, emailData);
        
        if (result.success) {
            // Update user record
            user.emailSent = true;
            user.emailSentAt = new Date();
            await user.save();
            
            console.log(`✅ Email resent successfully to: ${user.email}`);
            return { success: true, emailData };
        } else {
            console.error(`❌ Failed to resend email to ${user.email}:`, result.error);
            return { success: false, reason: result.error };
        }
        
    } catch (error) {
        console.error(`❌ Error resending email for ${user.email}:`, error.message);
        return { success: false, reason: error.message };
    }
}

// Main execution function
async function main() {
    console.log('🚀 Starting confirmation email resend script...');
    console.log('📋 Configuration:', {
        email: config.email,
        userId: config.userId,
        orderId: config.orderId,
        batch: config.batch,
        status: config.status,
        limit: config.limit,
        noEmailSent: config.noEmailSent,
        dryRun: config.dryRun,
        force: config.force
    });
    
    await connectDB();
    
    let users = [];
    let results = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };
    
    try {
        if (config.batch) {
            // Batch processing
            users = await findBatchUsers();
            
            if (users.length === 0) {
                console.log('ℹ️ No users found matching the criteria');
                return;
            }
            
            console.log(`📦 Processing ${users.length} users in batch...`);
            
            for (const user of users) {
                const result = await resendEmailForUser(user);
                
                if (result.success) {
                    results.success++;
                } else if (result.reason === 'No QR code available') {
                    results.skipped++;
                } else {
                    results.failed++;
                    results.errors.push({
                        email: user.email,
                        error: result.reason
                    });
                }
                
                // Add delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } else {
            // Single user processing
            const user = await findUser();
            
            if (!user) {
                console.error('❌ User not found with the provided criteria');
                return;
            }
            
            console.log(`👤 Found user: ${user.name} (${user.email})`);
            
            // Check if email was already sent (unless forced)
            if (user.emailSent && !config.force) {
                console.log('ℹ️ Email was already sent to this user. Use --force to resend anyway.');
                return;
            }
            
            const result = await resendEmailForUser(user);
            
            if (result.success) {
                results.success = 1;
                console.log('🎉 Email resent successfully!');
            } else {
                results.failed = 1;
                results.errors.push({
                    email: user.email,
                    error: result.reason
                });
                console.error('❌ Failed to resend email');
            }
        }
        
    } catch (error) {
        console.error('❌ Script execution error:', error.message);
        results.failed++;
        results.errors.push({
            general: error.message
        });
    } finally {
        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`✅ Successful: ${results.success}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`⏭️ Skipped: ${results.skipped}`);
        
        if (results.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            results.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.email || 'General'}: ${error.error || error.general}`);
            });
        }
        
        await mongoose.connection.close();
        console.log('\n🔚 Script completed');
    }
}

// Help text
function showHelp() {
    console.log(`
📧 Confirmation Email Resend Script

USAGE EXAMPLES:

Single User Operations:
  node resend-confirmation-emails.js --email user@example.com
  node resend-confirmation-emails.js --user-id 507f1f77bcf86cd799439011
  node resend-confirmation-emails.js --order-id order_123456789
  node resend-confirmation-emails.js --email user@example.com --force

Batch Operations:
  node resend-confirmation-emails.js --batch --limit 10
  node resend-confirmation-emails.js --batch --no-email-sent --limit 5
  node resend-confirmation-emails.js --batch --status completed --limit 20

Testing:
  node resend-confirmation-emails.js --email user@example.com --dry-run

OPTIONS:
  --email <email>         Find user by email address
  --user-id <id>         Find user by MongoDB ObjectId
  --order-id <id>        Find user by order ID
  --batch                Process multiple users
  --status <status>      Filter by payment status (default: completed)
  --limit <number>       Limit number of users in batch (default: 10)
  --no-email-sent        Only process users who haven't received emails
  --dry-run              Test run without sending actual emails
  --force                Force resend even if email was already sent
  --help                 Show this help message

EXAMPLES:
  # Resend to specific user
  node resend-confirmation-emails.js --email john@example.com

  # Resend to users who haven't received emails yet
  node resend-confirmation-emails.js --batch --no-email-sent --limit 5

  # Test run for batch processing
  node resend-confirmation-emails.js --batch --limit 3 --dry-run
`);
}

// Check for help flag or no arguments
if (hasArg('--help') || args.length === 0) {
    showHelp();
    process.exit(0);
}

// Validate arguments
if (!config.batch && !config.email && !config.userId && !config.orderId) {
    console.error('❌ Error: You must specify either --batch or one of --email, --user-id, --order-id');
    console.log('Use --help for usage examples');
    process.exit(1);
}

// Run the script
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});