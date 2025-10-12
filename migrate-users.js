const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
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

// Function to read CSV file and extract successful order IDs
function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

// Function to create Excel/CSV report
function createReport(data, filename, format = 'xlsx') {
    if (data.length === 0) {
        console.log(`No data to write to ${filename}`);
        return;
    }

    if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, filename);
    } else if (format === 'csv') {
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
    }
    
    console.log(`${format.toUpperCase()} file created: ${filename}`);
}

// Function to check if user is a team member in any team (comprehensive check)
async function isUserTeamMember(userId) {
    try {
        // Convert userId to ObjectId if it's a string
        const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        
        // Check in TeamComposition as team leader
        const asTeamLeader = await TeamComposition.find({
            'teamLeader.userId': userObjectId
        });
        
        // Check in TeamComposition as team member
        const asTeamMember = await TeamComposition.find({
            'teamMembers.userId': userObjectId
        });
        
        // Also check in User's teamRegistrations field
        const user = await User.findById(userObjectId);
        const hasTeamRegistrations = user && user.teamRegistrations && user.teamRegistrations.length > 0;
        
        const totalTeamMemberships = asTeamLeader.length + asTeamMember.length;
        
        if (totalTeamMemberships > 0 || hasTeamRegistrations) {
            console.log(`User ${userId} found in teams: Leader in ${asTeamLeader.length}, Member in ${asTeamMember.length}, User registrations: ${hasTeamRegistrations ? user.teamRegistrations.length : 0}`);
            return {
                isTeamMember: true,
                asLeader: asTeamLeader.length,
                asMember: asTeamMember.length,
                userRegistrations: hasTeamRegistrations ? user.teamRegistrations.length : 0
            };
        }
        
        return { isTeamMember: false, asLeader: 0, asMember: 0, userRegistrations: 0 };
    } catch (error) {
        console.error(`Error checking team membership for user ${userId}:`, error);
        return { isTeamMember: false, asLeader: 0, asMember: 0, userRegistrations: 0 };
    }
}

// Main function to migrate users with unsuccessful payments
async function migrateUnsuccessfulPaymentUsers() {
    try {
        await connectToMongoDB();
        
        console.log("=== STEP 1: Reading CSV file to get successful order IDs ===");
        const csvData = await readCSVFile('success.csv');
        
        // Extract successful order IDs from CSV (both Order Id and Cashfree Order ID)
        const successfulOrderIds = new Set();
        csvData.forEach(row => {
            const orderAmount = parseFloat(row['Order Amount']);
            if (orderAmount > 2) { // Only consider payments > 2 INR
                if (row['Order Id']) {
                    successfulOrderIds.add(row['Order Id'].trim());
                }
                if (row['Cashfree Order ID']) {
                    successfulOrderIds.add(row['Cashfree Order ID'].trim());
                }
            }
        });
        
        console.log(`Found ${successfulOrderIds.size} successful order IDs in CSV`);
        
        console.log("\n=== STEP 2: Finding all purchases and their success status ===");
        const allPurchases = await Purchase.find({
            totalAmount: { $gt: 2 } // Only consider purchases > 2 INR
        }).populate('userId');
        
        console.log(`Found ${allPurchases.length} purchases with amount > 2 INR`);
        
        // Categorize purchases
        const successfulPurchases = [];
        const unsuccessfulPurchases = [];
        
        for (const purchase of allPurchases) {
            const orderId = purchase.orderId;
            const cashfreeOrderId = purchase.cashfreeOrderId;
            
            // Check if this purchase is in the successful CSV
            const isInCSV = (orderId && successfulOrderIds.has(orderId)) || 
                           (cashfreeOrderId && successfulOrderIds.has(cashfreeOrderId));
            
            // Also check payment status in database
            const isCompletedInDB = purchase.paymentStatus === 'completed';
            
            if (isInCSV && isCompletedInDB) {
                successfulPurchases.push(purchase);
            } else {
                unsuccessfulPurchases.push(purchase);
            }
        }
        
        console.log(`Successful purchases: ${successfulPurchases.length}`);
        console.log(`Unsuccessful purchases: ${unsuccessfulPurchases.length}`);
        
        console.log("\n=== STEP 3: Identifying users to migrate ===");
        const usersToMigrate = [];
        const usersToKeep = [];
        const teamMemberUsers = [];
        
        // Get all users linked to unsuccessful purchases
        const unsuccessfulUserIds = new Set();
        unsuccessfulPurchases.forEach(purchase => {
            if (purchase.userId) {
                unsuccessfulUserIds.add(purchase.userId._id.toString());
            }
        });
        
        console.log(`Users linked to unsuccessful purchases: ${unsuccessfulUserIds.size}`);
        
        // Check each user for team membership
        for (const userId of unsuccessfulUserIds) {
            const user = await User.findById(userId);
            if (user) {
                const teamMembershipInfo = await isUserTeamMember(userId);
                
                if (teamMembershipInfo.isTeamMember) {
                    // Keep team members in main collection
                    teamMemberUsers.push({
                        userId: userId,
                        userName: user.name,
                        userEmail: user.email,
                        asLeader: teamMembershipInfo.asLeader,
                        asMember: teamMembershipInfo.asMember,
                        userRegistrations: teamMembershipInfo.userRegistrations,
                        reason: `Team member - Leader in ${teamMembershipInfo.asLeader} teams, Member in ${teamMembershipInfo.asMember} teams, User registrations: ${teamMembershipInfo.userRegistrations}`
                    });
                    usersToKeep.push(user);
                } else {
                    // Move non-team members
                    usersToMigrate.push(user);
                }
            }
        }
        
        console.log(`Users to migrate to UpdatedUser: ${usersToMigrate.length}`);
        console.log(`Team members to keep in User: ${teamMemberUsers.length}`);
        
        console.log("\n=== STEP 4: Performing migration ===");
        const migratedUsers = [];
        const migrationErrors = [];
        
        for (const user of usersToMigrate) {
            try {
                // Create new UpdatedUser document
                const updatedUserData = {
                    ...user.toObject(),
                    originalUserId: user._id,
                    movedAt: new Date(),
                    moveReason: "Payment status not successful"
                };
                
                // Remove the _id to let MongoDB generate a new one
                delete updatedUserData._id;
                
                // Create in UpdatedUser collection
                const updatedUser = new UpdatedUser(updatedUserData);
                await updatedUser.save();
                
                // Remove from User collection
                await User.findByIdAndDelete(user._id);
                
                migratedUsers.push({
                    originalUserId: user._id.toString(),
                    newUpdatedUserId: updatedUser._id.toString(),
                    userName: user.name,
                    userEmail: user.email,
                    events: user.events.join(', '),
                    migratedAt: new Date().toISOString()
                });
                
                console.log(`Migrated user: ${user.name} (${user.email})`);
                
            } catch (error) {
                migrationErrors.push({
                    userId: user._id.toString(),
                    userName: user.name,
                    userEmail: user.email,
                    error: error.message
                });
                console.error(`Error migrating user ${user.name}: ${error.message}`);
            }
        }
        
        console.log("\n=== MIGRATION RESULTS ===");
        console.log(`Successfully migrated: ${migratedUsers.length} users`);
        console.log(`Migration errors: ${migrationErrors.length}`);
        console.log(`Team members kept in Users: ${teamMemberUsers.length}`);
        
        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        // Create reports
        if (migratedUsers.length > 0) {
            createReport(migratedUsers, `${outputDir}/migrated_users_report.xlsx`);
            createReport(migratedUsers, `${outputDir}/migrated_users_report.csv`, 'csv');
        }
        
        if (teamMemberUsers.length > 0) {
            createReport(teamMemberUsers, `${outputDir}/team_members_kept_report.xlsx`);
        }
        
        if (migrationErrors.length > 0) {
            createReport(migrationErrors, `${outputDir}/migration_errors_report.xlsx`);
        }
        
        // Create summary report
        const summaryReport = [
            { 'Metric': 'Total Purchases (>2 INR)', 'Count': allPurchases.length },
            { 'Metric': 'Successful Purchases', 'Count': successfulPurchases.length },
            { 'Metric': 'Unsuccessful Purchases', 'Count': unsuccessfulPurchases.length },
            { 'Metric': 'Users with Unsuccessful Payments', 'Count': unsuccessfulUserIds.size },
            { 'Metric': 'Users Migrated to UpdatedUser', 'Count': migratedUsers.length },
            { 'Metric': 'Team Members Kept in Users', 'Count': teamMemberUsers.length },
            { 'Metric': 'Migration Errors', 'Count': migrationErrors.length }
        ];
        
        createReport(summaryReport, `${outputDir}/migration_summary.xlsx`);
        
        console.log("\n=== FILES CREATED ===");
        console.log(`1. ${outputDir}/migrated_users_report.xlsx - List of migrated users`);
        console.log(`2. ${outputDir}/migrated_users_report.csv - CSV format of migrated users`);
        console.log(`3. ${outputDir}/team_members_kept_report.xlsx - Team members kept in Users`);
        console.log(`4. ${outputDir}/migration_errors_report.xlsx - Migration errors (if any)`);
        console.log(`5. ${outputDir}/migration_summary.xlsx - Summary statistics`);
        
        // Final verification
        console.log("\n=== VERIFICATION ===");
        const remainingUsers = await User.countDocuments();
        const updatedUsers = await UpdatedUser.countDocuments();
        
        console.log(`Remaining users in Users collection: ${remainingUsers}`);
        console.log(`Users in UpdatedUser collection: ${updatedUsers}`);
        
    } catch (error) {
        console.error("Error in migration process:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Safety check function
async function previewMigration() {
    try {
        await connectToMongoDB();
        
        console.log("=== PREVIEW MODE - NO CHANGES WILL BE MADE ===");
        
        // Read CSV and get successful order IDs
        const csvData = await readCSVFile('success.csv');
        const successfulOrderIds = new Set();
        csvData.forEach(row => {
            const orderAmount = parseFloat(row['Order Amount']);
            if (orderAmount > 2) {
                if (row['Order Id']) successfulOrderIds.add(row['Order Id'].trim());
                if (row['Cashfree Order ID']) successfulOrderIds.add(row['Cashfree Order ID'].trim());
            }
        });
        
        const allPurchases = await Purchase.find({ totalAmount: { $gt: 2 } }).populate('userId');
        
        // Find unsuccessful purchases
        const unsuccessfulUserIds = new Set();
        for (const purchase of allPurchases) {
            const isInCSV = (purchase.orderId && successfulOrderIds.has(purchase.orderId)) || 
                           (purchase.cashfreeOrderId && successfulOrderIds.has(purchase.cashfreeOrderId));
            const isCompletedInDB = purchase.paymentStatus === 'completed';
            
            if (!isInCSV || !isCompletedInDB) {
                if (purchase.userId) {
                    unsuccessfulUserIds.add(purchase.userId._id.toString());
                }
            }
        }
        
        console.log(`Users with unsuccessful payments: ${unsuccessfulUserIds.size}`);
        
        let teamMemberCount = 0;
        let toMigrateCount = 0;
        
        for (const userId of unsuccessfulUserIds) {
            const teamMembershipInfo = await isUserTeamMember(userId);
            if (teamMembershipInfo.isTeamMember) {
                teamMemberCount++;
                console.log(`Preview: User ${userId} is team member - Leader: ${teamMembershipInfo.asLeader}, Member: ${teamMembershipInfo.asMember}, Registrations: ${teamMembershipInfo.userRegistrations}`);
            } else {
                toMigrateCount++;
            }
        }
        
        console.log(`Team members to keep: ${teamMemberCount}`);
        console.log(`Users to migrate: ${toMigrateCount}`);
        
    } catch (error) {
        console.error("Error in preview:", error);
    } finally {
        await mongoose.disconnect();
    }
}

// Command line argument handling
const args = process.argv.slice(2);
if (args.includes('--preview')) {
    console.log("Running in preview mode...");
    previewMigration();
} else if (args.includes('--execute')) {
    console.log("Executing migration...");
    migrateUnsuccessfulPaymentUsers();
} else {
    console.log("Usage: node migrate-users.js [--preview|--execute]");
    console.log("--preview: Show what would be migrated without making changes");
    console.log("--execute: Actually perform the migration");
}