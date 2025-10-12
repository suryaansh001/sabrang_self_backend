const mongoose = require('mongoose');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();
const { User, Purchase } = require('./models/models');

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

// Function to create Excel file
function createExcelFile(data, filename) {
    if (data.length === 0) {
        console.log(`No data to write to ${filename}`);
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
    console.log(`Excel file created: ${filename}`);
}

// Function to create CSV file
function createCSVFile(data, filename) {
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
                // Escape commas and quotes in CSV
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

// Main function to find duplicate user registrations
async function findDuplicateUserRegistrations() {
    try {
        await connectToMongoDB();
        
        console.log("Analyzing duplicate user registrations...");
        
        // Method 1: Find users with multiple purchases by email
        console.log("\n=== METHOD 1: Finding users with multiple purchases by email ===");
        const duplicatesByEmail = await Purchase.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    'userDetails.email': { $exists: true, $ne: null, $ne: '' }
                }
            },
            {
                $group: {
                    _id: { email: '$userDetails.email' },
                    purchases: {
                        $push: {
                            purchaseId: '$_id',
                            orderId: '$orderId',
                            cashfreeOrderId: '$cashfreeOrderId',
                            totalAmount: '$totalAmount',
                            purchaseDate: '$purchaseDate',
                            name: '$userDetails.name',
                            contactNo: '$userDetails.contactNo',
                            items: '$items'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        console.log(`Found ${duplicatesByEmail.length} emails with multiple purchases`);

        // Method 2: Find users with multiple purchases by contact number
        console.log("\n=== METHOD 2: Finding users with multiple purchases by contact number ===");
        const duplicatesByContact = await Purchase.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    'userDetails.contactNo': { $exists: true, $ne: null, $ne: '', $ne: '9999999999' }
                }
            },
            {
                $group: {
                    _id: { contactNo: '$userDetails.contactNo' },
                    purchases: {
                        $push: {
                            purchaseId: '$_id',
                            orderId: '$orderId',
                            cashfreeOrderId: '$cashfreeOrderId',
                            totalAmount: '$totalAmount',
                            purchaseDate: '$purchaseDate',
                            name: '$userDetails.name',
                            email: '$userDetails.email',
                            items: '$items'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        console.log(`Found ${duplicatesByContact.length} contact numbers with multiple purchases`);

        // Method 3: Find users in User schema with multiple purchase references
        console.log("\n=== METHOD 3: Finding users with multiple registration history entries ===");
        const usersWithMultipleRegistrations = await User.find({
            'registrationHistory.1': { $exists: true } // Has at least 2 entries
        }).populate('registrationHistory.purchaseId');

        console.log(`Found ${usersWithMultipleRegistrations.length} users with multiple registration history entries`);

        // Prepare data for Excel export
        const duplicateEmailData = [];
        const duplicateContactData = [];
        const duplicateUserData = [];

        // Process email duplicates
        duplicatesByEmail.forEach((group, index) => {
            const email = group._id.email;
            group.purchases.forEach((purchase, purchaseIndex) => {
                duplicateEmailData.push({
                    'Group ID': `EMAIL_${index + 1}`,
                    'Duplicate Type': 'Same Email',
                    'Email': email,
                    'Purchase Number': purchaseIndex + 1,
                    'Total Purchases': group.count,
                    'Purchase ID': purchase.purchaseId.toString(),
                    'Order ID': purchase.orderId || 'N/A',
                    'Cashfree Order ID': purchase.cashfreeOrderId || 'N/A',
                    'User Name': purchase.name || 'N/A',
                    'Contact Number': purchase.contactNo || 'N/A',
                    'Total Amount': purchase.totalAmount,
                    'Purchase Date': purchase.purchaseDate,
                    'Items': purchase.items.map(item => `${item.itemName} (₹${item.price})`).join('; '),
                    'Items Count': purchase.items.length
                });
            });
        });

        // Process contact duplicates
        duplicatesByContact.forEach((group, index) => {
            const contactNo = group._id.contactNo;
            group.purchases.forEach((purchase, purchaseIndex) => {
                duplicateContactData.push({
                    'Group ID': `CONTACT_${index + 1}`,
                    'Duplicate Type': 'Same Contact',
                    'Contact Number': contactNo,
                    'Purchase Number': purchaseIndex + 1,
                    'Total Purchases': group.count,
                    'Purchase ID': purchase.purchaseId.toString(),
                    'Order ID': purchase.orderId || 'N/A',
                    'Cashfree Order ID': purchase.cashfreeOrderId || 'N/A',
                    'User Name': purchase.name || 'N/A',
                    'Email': purchase.email || 'N/A',
                    'Total Amount': purchase.totalAmount,
                    'Purchase Date': purchase.purchaseDate,
                    'Items': purchase.items.map(item => `${item.itemName} (₹${item.price})`).join('; '),
                    'Items Count': purchase.items.length
                });
            });
        });

        // Process user schema duplicates
        usersWithMultipleRegistrations.forEach((user, index) => {
            user.registrationHistory.forEach((registration, regIndex) => {
                const purchase = registration.purchaseId;
                duplicateUserData.push({
                    'Group ID': `USER_${index + 1}`,
                    'Duplicate Type': 'Multiple User Registrations',
                    'User ID': user._id.toString(),
                    'Registration Number': regIndex + 1,
                    'Total Registrations': user.registrationHistory.length,
                    'User Name': user.name,
                    'Email': user.email,
                    'Contact Number': user.contactNo,
                    'Purchase ID': purchase ? purchase._id.toString() : 'N/A',
                    'Order ID': purchase ? purchase.orderId : 'N/A',
                    'Cashfree Order ID': purchase ? purchase.cashfreeOrderId : 'N/A',
                    'Total Amount': purchase ? purchase.totalAmount : 'N/A',
                    'Purchase Date': purchase ? purchase.purchaseDate : 'N/A',
                    'Registration Type': registration.registrationType,
                    'Events Registered': registration.eventsRegistered.join(', '),
                    'Registered At': registration.registeredAt,
                    'User Events': user.events.join(', '),
                    'User Validated': user.isvalidated
                });
            });
        });

        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Create files
        if (duplicateEmailData.length > 0) {
            createExcelFile(duplicateEmailData, `${outputDir}/duplicate_users_by_email.xlsx`);
            createCSVFile(duplicateEmailData, `${outputDir}/duplicate_users_by_email.csv`);
        }

        if (duplicateContactData.length > 0) {
            createExcelFile(duplicateContactData, `${outputDir}/duplicate_users_by_contact.xlsx`);
            createCSVFile(duplicateContactData, `${outputDir}/duplicate_users_by_contact.csv`);
        }

        if (duplicateUserData.length > 0) {
            createExcelFile(duplicateUserData, `${outputDir}/duplicate_users_schema.xlsx`);
            createCSVFile(duplicateUserData, `${outputDir}/duplicate_users_schema.csv`);
        }

        // Create summary analysis
        const summaryData = [
            { 'Metric': 'Duplicate Emails Found', 'Count': duplicatesByEmail.length },
            { 'Metric': 'Duplicate Contacts Found', 'Count': duplicatesByContact.length },
            { 'Metric': 'Users with Multiple Registrations', 'Count': usersWithMultipleRegistrations.length },
            { 'Metric': 'Total Email Duplicate Records', 'Count': duplicateEmailData.length },
            { 'Metric': 'Total Contact Duplicate Records', 'Count': duplicateContactData.length },
            { 'Metric': 'Total User Schema Duplicate Records', 'Count': duplicateUserData.length }
        ];

        createExcelFile(summaryData, `${outputDir}/duplicate_analysis_summary.xlsx`);

        console.log("\n=== DUPLICATE ANALYSIS RESULTS ===");
        console.log(`Emails with multiple purchases: ${duplicatesByEmail.length}`);
        console.log(`Contact numbers with multiple purchases: ${duplicatesByContact.length}`);
        console.log(`Users with multiple registration entries: ${usersWithMultipleRegistrations.length}`);

        // Show top duplicates
        if (duplicatesByEmail.length > 0) {
            console.log("\n=== TOP EMAIL DUPLICATES ===");
            duplicatesByEmail.slice(0, 5).forEach((group, index) => {
                console.log(`${index + 1}. ${group._id.email}: ${group.count} purchases`);
                console.log(`   Total Amount: ₹${group.purchases.reduce((sum, p) => sum + p.totalAmount, 0)}`);
            });
        }

        if (duplicatesByContact.length > 0) {
            console.log("\n=== TOP CONTACT DUPLICATES ===");
            duplicatesByContact.slice(0, 5).forEach((group, index) => {
                console.log(`${index + 1}. ${group._id.contactNo}: ${group.count} purchases`);
                console.log(`   Total Amount: ₹${group.purchases.reduce((sum, p) => sum + p.totalAmount, 0)}`);
            });
        }

        // Calculate financial impact
        const totalDuplicateAmountByEmail = duplicatesByEmail.reduce((total, group) => {
            return total + group.purchases.reduce((sum, p) => sum + p.totalAmount, 0);
        }, 0);

        const totalDuplicateAmountByContact = duplicatesByContact.reduce((total, group) => {
            return total + group.purchases.reduce((sum, p) => sum + p.totalAmount, 0);
        }, 0);

        console.log("\n=== FINANCIAL IMPACT ===");
        console.log(`Total amount from email duplicates: ₹${totalDuplicateAmountByEmail}`);
        console.log(`Total amount from contact duplicates: ₹${totalDuplicateAmountByContact}`);

        console.log("\n=== FILES CREATED ===");
        console.log(`1. ${outputDir}/duplicate_users_by_email.xlsx/.csv - Users with same email, different orders`);
        console.log(`2. ${outputDir}/duplicate_users_by_contact.xlsx/.csv - Users with same contact, different orders`);
        console.log(`3. ${outputDir}/duplicate_users_schema.xlsx/.csv - Users with multiple registration history`);
        console.log(`4. ${outputDir}/duplicate_analysis_summary.xlsx - Summary statistics`);

    } catch (error) {
        console.error("Error in duplicate analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the duplicate analysis
findDuplicateUserRegistrations();