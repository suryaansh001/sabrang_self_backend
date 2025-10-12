const mongoose = require('mongoose');
const fs = require('fs');
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

// Function to create Excel report
function createExcelReport(data, filename) {
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

// Function to create CSV report
function createCSVReport(data, filename) {
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

// Main function to check QR code generation status
async function checkQRCodeGeneration() {
    try {
        await connectToMongoDB();
        
        console.log("=== CHECKING QR CODE GENERATION STATUS ===");
        
        // Get all users from main Users collection
        const allUsers = await User.find({});
        console.log(`Total Users in main collection: ${allUsers.length}`);
        
        // Get all users from UpdatedUser collection
        const updatedUsers = await UpdatedUser.find({});
        console.log(`Total Users in UpdatedUser collection: ${updatedUsers.length}`);
        
        // Analyze QR code status for main Users
        const usersWithQR = [];
        const usersWithoutQR = [];
        const usersQRAnalysis = [];
        
        for (const user of allUsers) {
            const hasQRPath = user.qrPath && user.qrPath.trim() !== '';
            const hasQRBase64 = user.qrCodeBase64 && user.qrCodeBase64.trim() !== '';
            const hasAnyQR = hasQRPath || hasQRBase64;
            
            // Get user's purchases to check QR generation in Purchase schema
            const userPurchases = await Purchase.find({ userId: user._id });
            const purchasesWithQR = userPurchases.filter(p => p.qrGenerated === true);
            
            const userAnalysis = {
                'User ID': user._id.toString(),
                'User Name': user.name,
                'User Email': user.email,
                'Events': user.events.join(', ') || 'None',
                'Is Validated': user.isvalidated,
                'Has QR Path': hasQRPath,
                'Has QR Base64': hasQRBase64,
                'Has Any QR': hasAnyQR,
                'QR Path': user.qrPath || 'None',
                'Total Purchases': userPurchases.length,
                'Purchases with QR': purchasesWithQR.length,
                'University': user.universityName || 'N/A',
                'Contact': user.contactNo || 'N/A',
                'User Type': user.userType || 'participant',
                'Created At': user.createdAt.toISOString(),
                'Updated At': user.updatedAt.toISOString()
            };
            
            usersQRAnalysis.push(userAnalysis);
            
            if (hasAnyQR) {
                usersWithQR.push(userAnalysis);
            } else {
                usersWithoutQR.push(userAnalysis);
            }
        }
        
        console.log(`Users WITH QR codes: ${usersWithQR.length}`);
        console.log(`Users WITHOUT QR codes: ${usersWithoutQR.length}`);
        
        // Analyze QR code status for UpdatedUsers (migrated users)
        const updatedUsersAnalysis = [];
        let updatedUsersWithQR = 0;
        let updatedUsersWithoutQR = 0;
        
        for (const user of updatedUsers) {
            const hasQRPath = user.qrPath && user.qrPath.trim() !== '';
            const hasQRBase64 = user.qrCodeBase64 && user.qrCodeBase64.trim() !== '';
            const hasAnyQR = hasQRPath || hasQRBase64;
            
            updatedUsersAnalysis.push({
                'User ID': user._id.toString(),
                'Original User ID': user.originalUserId ? user.originalUserId.toString() : 'N/A',
                'User Name': user.name,
                'User Email': user.email,
                'Events': user.events.join(', ') || 'None',
                'Is Validated': user.isvalidated,
                'Has QR Path': hasQRPath,
                'Has QR Base64': hasQRBase64,
                'Has Any QR': hasAnyQR,
                'QR Path': user.qrPath || 'None',
                'Move Reason': user.moveReason || 'N/A',
                'Moved At': user.movedAt ? user.movedAt.toISOString() : 'N/A',
                'University': user.universityName || 'N/A',
                'Contact': user.contactNo || 'N/A'
            });
            
            if (hasAnyQR) {
                updatedUsersWithQR++;
            } else {
                updatedUsersWithoutQR++;
            }
        }
        
        // Analyze Purchase schema QR generation
        const allPurchases = await Purchase.find({});
        const purchasesWithQR = allPurchases.filter(p => p.qrGenerated === true);
        const purchasesWithoutQR = allPurchases.filter(p => p.qrGenerated !== true);
        
        console.log(`\nTotal Purchases: ${allPurchases.length}`);
        console.log(`Purchases WITH QR generated: ${purchasesWithQR.length}`);
        console.log(`Purchases WITHOUT QR generated: ${purchasesWithoutQR.length}`);
        
        // Create detailed purchase QR analysis
        const purchaseQRAnalysis = [];
        for (const purchase of allPurchases) {
            const user = purchase.userId ? await User.findById(purchase.userId) : null;
            
            purchaseQRAnalysis.push({
                'Purchase ID': purchase._id.toString(),
                'Order ID': purchase.orderId,
                'Cashfree Order ID': purchase.cashfreeOrderId || 'N/A',
                'User ID': purchase.userId ? purchase.userId.toString() : 'N/A',
                'User Name': user ? user.name : purchase.userDetails?.name || 'N/A',
                'User Email': user ? user.email : purchase.userDetails?.email || 'N/A',
                'Payment Status': purchase.paymentStatus,
                'QR Generated': purchase.qrGenerated,
                'QR Path': purchase.qrPath || 'None',
                'QR Base64 Exists': purchase.qrCodeBase64 ? 'Yes' : 'No',
                'User Registered': purchase.userRegistered,
                'Email Sent': purchase.emailSent,
                'Total Amount': purchase.totalAmount,
                'Purchase Date': purchase.purchaseDate.toISOString(),
                'Items': purchase.items.map(item => item.itemName).join(', ')
            });
        }
        
        // Create output directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        // Create reports
        createExcelReport(usersQRAnalysis, `${outputDir}/all_users_qr_analysis.xlsx`);
        createExcelReport(usersWithoutQR, `${outputDir}/users_without_qr.xlsx`);
        createCSVReport(usersWithoutQR, `${outputDir}/users_without_qr.csv`);
        createExcelReport(usersWithQR, `${outputDir}/users_with_qr.xlsx`);
        
        if (updatedUsersAnalysis.length > 0) {
            createExcelReport(updatedUsersAnalysis, `${outputDir}/updated_users_qr_analysis.xlsx`);
        }
        
        createExcelReport(purchaseQRAnalysis, `${outputDir}/purchase_qr_analysis.xlsx`);
        
        // Create summary report
        const summaryReport = [
            { 'Collection': 'Users', 'Total': allUsers.length, 'With QR': usersWithQR.length, 'Without QR': usersWithoutQR.length, 'QR Coverage %': `${((usersWithQR.length / allUsers.length) * 100).toFixed(2)}%` },
            { 'Collection': 'UpdatedUsers', 'Total': updatedUsers.length, 'With QR': updatedUsersWithQR, 'Without QR': updatedUsersWithoutQR, 'QR Coverage %': updatedUsers.length > 0 ? `${((updatedUsersWithQR / updatedUsers.length) * 100).toFixed(2)}%` : '0%' },
            { 'Collection': 'Purchases', 'Total': allPurchases.length, 'With QR': purchasesWithQR.length, 'Without QR': purchasesWithoutQR.length, 'QR Coverage %': `${((purchasesWithQR.length / allPurchases.length) * 100).toFixed(2)}%` }
        ];
        
        createExcelReport(summaryReport, `${outputDir}/qr_generation_summary.xlsx`);
        
        // Event-wise QR analysis
        const eventQRAnalysis = {};
        for (const user of allUsers) {
            if (user.events && user.events.length > 0) {
                for (const event of user.events) {
                    if (!eventQRAnalysis[event]) {
                        eventQRAnalysis[event] = { total: 0, withQR: 0, withoutQR: 0 };
                    }
                    eventQRAnalysis[event].total++;
                    
                    const hasQR = (user.qrPath && user.qrPath.trim() !== '') || (user.qrCodeBase64 && user.qrCodeBase64.trim() !== '');
                    if (hasQR) {
                        eventQRAnalysis[event].withQR++;
                    } else {
                        eventQRAnalysis[event].withoutQR++;
                    }
                }
            }
        }
        
        const eventReportData = Object.entries(eventQRAnalysis).map(([event, stats]) => ({
            'Event Name': event,
            'Total Users': stats.total,
            'Users with QR': stats.withQR,
            'Users without QR': stats.withoutQR,
            'QR Coverage %': `${((stats.withQR / stats.total) * 100).toFixed(2)}%`
        }));
        
        createExcelReport(eventReportData, `${outputDir}/event_wise_qr_analysis.xlsx`);
        
        console.log("\n=== QR CODE ANALYSIS COMPLETE ===");
        console.log("Files created:");
        console.log("1. all_users_qr_analysis.xlsx - Complete QR analysis for all users");
        console.log("2. users_without_qr.xlsx/.csv - Users missing QR codes");
        console.log("3. users_with_qr.xlsx - Users with QR codes");
        console.log("4. updated_users_qr_analysis.xlsx - QR analysis for migrated users");
        console.log("5. purchase_qr_analysis.xlsx - QR analysis from Purchase schema");
        console.log("6. qr_generation_summary.xlsx - Summary statistics");
        console.log("7. event_wise_qr_analysis.xlsx - Event-wise QR coverage");
        
        console.log("\n=== KEY STATISTICS ===");
        console.log(`Main Users Collection:`);
        console.log(`  Total users: ${allUsers.length}`);
        console.log(`  Users with QR: ${usersWithQR.length} (${((usersWithQR.length / allUsers.length) * 100).toFixed(2)}%)`);
        console.log(`  Users without QR: ${usersWithoutQR.length} (${((usersWithoutQR.length / allUsers.length) * 100).toFixed(2)}%)`);
        
        if (updatedUsers.length > 0) {
            console.log(`\nUpdatedUsers Collection:`);
            console.log(`  Total users: ${updatedUsers.length}`);
            console.log(`  Users with QR: ${updatedUsersWithQR} (${((updatedUsersWithQR / updatedUsers.length) * 100).toFixed(2)}%)`);
            console.log(`  Users without QR: ${updatedUsersWithoutQR} (${((updatedUsersWithoutQR / updatedUsers.length) * 100).toFixed(2)}%)`);
        }
        
        console.log(`\nPurchases Analysis:`);
        console.log(`  Total purchases: ${allPurchases.length}`);
        console.log(`  Purchases with QR: ${purchasesWithQR.length} (${((purchasesWithQR.length / allPurchases.length) * 100).toFixed(2)}%)`);
        console.log(`  Purchases without QR: ${purchasesWithoutQR.length} (${((purchasesWithoutQR.length / allPurchases.length) * 100).toFixed(2)}%)`);
        
        console.log(`\nEvent-wise QR Coverage:`);
        Object.entries(eventQRAnalysis)
            .sort(([,a], [,b]) => b.total - a.total)
            .slice(0, 10)
            .forEach(([event, stats]) => {
                console.log(`  ${event}: ${stats.withQR}/${stats.total} (${((stats.withQR / stats.total) * 100).toFixed(2)}%)`);
            });
        
        // Identify critical issues
        console.log("\n=== CRITICAL ISSUES ===");
        const validatedUsersWithoutQR = usersWithoutQR.filter(u => u['Is Validated'] === true);
        if (validatedUsersWithoutQR.length > 0) {
            console.log(`⚠️  ${validatedUsersWithoutQR.length} validated users don't have QR codes!`);
        }
        
        const paidUsersWithoutQR = purchasesWithoutQR.filter(p => p.paymentStatus === 'completed');
        if (paidUsersWithoutQR.length > 0) {
            console.log(`⚠️  ${paidUsersWithoutQR.length} completed purchases don't have QR codes generated!`);
        }
        
    } catch (error) {
        console.error("Error in QR code analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the QR code analysis
checkQRCodeGeneration();