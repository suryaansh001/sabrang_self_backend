const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
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

// Function to read CSV file and extract order IDs
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

// Main function to find database orders not in CSV
async function findDatabaseOrdersNotInCSV() {
    try {
        await connectToMongoDB();
        
        // Read CSV file to get existing order IDs
        console.log("Reading CSV file to extract order IDs...");
        const csvData = await readCSVFile('success.csv');
        
        // Extract all order IDs from CSV (both Order Id and Cashfree Order ID)
        const csvOrderIds = new Set();
        csvData.forEach(row => {
            if (row['Order Id']) {
                csvOrderIds.add(row['Order Id'].trim());
            }
            if (row['Cashfree Order ID']) {
                csvOrderIds.add(row['Cashfree Order ID'].trim());
            }
        });
        
        console.log(`Found ${csvOrderIds.size} unique order IDs in CSV file`);
        
        // Find all successful purchases in database
        console.log("Querying database for successful purchases...");
        const successfulPurchases = await Purchase.find({
            paymentStatus: 'completed',
            totalAmount: { $gt: 2 } // Amount greater than 2
        }).populate('userId', 'name email contactNo events isvalidated universityName');
        
        console.log(`Found ${successfulPurchases.length} successful purchases in database`);
        
        // Filter purchases not in CSV
        const missingFromCSV = [];
        let processedCount = 0;
        
        for (const purchase of successfulPurchases) {
            const orderId = purchase.orderId;
            const cashfreeOrderId = purchase.cashfreeOrderId;
            
            // Check if this purchase's order IDs are in the CSV
            const foundInCSV = (orderId && csvOrderIds.has(orderId)) || 
                              (cashfreeOrderId && csvOrderIds.has(cashfreeOrderId));
            
            if (!foundInCSV) {
                // This purchase is not in the CSV file
                const user = purchase.userId;
                
                const recordData = {
                    'Order ID': orderId || 'N/A',
                    'Cashfree Order ID': cashfreeOrderId || 'N/A',
                    'Purchase ID': purchase._id.toString(),
                    'User ID': purchase.userId ? purchase.userId._id.toString() : 'N/A',
                    'User Name': user ? user.name : purchase.userDetails?.name || 'N/A',
                    'User Email': user ? user.email : purchase.userDetails?.email || 'N/A',
                    'User Contact': user ? user.contactNo : purchase.userDetails?.contactNo || 'N/A',
                    'User Events': user ? user.events.join(', ') : 'N/A',
                    'University': user ? user.universityName : purchase.userDetails?.universityName || 'N/A',
                    'Total Amount': purchase.totalAmount,
                    'Payment Status': purchase.paymentStatus,
                    'User Registered': purchase.userRegistered,
                    'QR Generated': purchase.qrGenerated,
                    'Email Sent': purchase.emailSent,
                    'User Validated': user ? user.isvalidated : 'N/A',
                    'Purchase Date': purchase.purchaseDate.toISOString(),
                    'Payment Completed At': purchase.paymentCompletedAt ? purchase.paymentCompletedAt.toISOString() : 'N/A',
                    'Items': purchase.items.map(item => `${item.itemName} (₹${item.price})`).join('; '),
                    'User Gender': user ? user.gender : purchase.userDetails?.gender || 'N/A',
                    'User Age': user ? user.age : purchase.userDetails?.age || 'N/A',
                    'User Address': user ? user.address : purchase.userDetails?.address || 'N/A',
                    'Transaction ID': purchase.transactionId || 'N/A',
                    'Payment Method': purchase.paymentMethod || 'N/A'
                };
                
                missingFromCSV.push(recordData);
            }
            
            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`Processed ${processedCount}/${successfulPurchases.length} purchases...`);
            }
        }
        
        console.log("\n=== REVERSE ANALYSIS RESULTS ===");
        console.log(`Total successful purchases in database: ${successfulPurchases.length}`);
        console.log(`Orders found in CSV: ${successfulPurchases.length - missingFromCSV.length}`);
        console.log(`Orders in database but NOT in CSV: ${missingFromCSV.length}`);
        
        // Create files in csvFiles directory
        const outputDir = './csvFiles';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        if (missingFromCSV.length > 0) {
            // Create both CSV and Excel files
            createCSVFile(missingFromCSV, `${outputDir}/successful_orders_missing_from_csv.csv`);
            createExcelFile(missingFromCSV, `${outputDir}/successful_orders_missing_from_csv.xlsx`);
            
            // Create summary by payment method
            const paymentMethodSummary = {};
            const universitySummary = {};
            const eventSummary = {};
            
            missingFromCSV.forEach(record => {
                const paymentMethod = record['Payment Method'] || 'Unknown';
                const university = record['University'] || 'Unknown';
                const events = record['User Events'] || 'None';
                
                paymentMethodSummary[paymentMethod] = (paymentMethodSummary[paymentMethod] || 0) + 1;
                universitySummary[university] = (universitySummary[university] || 0) + 1;
                
                if (events !== 'None' && events !== 'N/A') {
                    events.split(', ').forEach(event => {
                        eventSummary[event.trim()] = (eventSummary[event.trim()] || 0) + 1;
                    });
                }
            });
            
            // Create analysis summary
            const analysisData = [
                { 'Category': 'Total Records', 'Count': missingFromCSV.length },
                { 'Category': 'Average Amount', 'Count': (missingFromCSV.reduce((sum, r) => sum + parseFloat(r['Total Amount']), 0) / missingFromCSV.length).toFixed(2) },
                { 'Category': 'QR Generated', 'Count': missingFromCSV.filter(r => r['QR Generated'] === true).length },
                { 'Category': 'Emails Sent', 'Count': missingFromCSV.filter(r => r['Email Sent'] === true).length },
                { 'Category': 'Users Validated', 'Count': missingFromCSV.filter(r => r['User Validated'] === true).length }
            ];
            
            createExcelFile(analysisData, `${outputDir}/missing_orders_analysis.xlsx`);
            
            console.log("\n=== PAYMENT METHOD BREAKDOWN ===");
            Object.entries(paymentMethodSummary).forEach(([method, count]) => {
                console.log(`${method}: ${count}`);
            });
            
            console.log("\n=== TOP UNIVERSITIES ===");
            Object.entries(universitySummary)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .forEach(([university, count]) => {
                    console.log(`${university}: ${count}`);
                });
            
            console.log("\n=== EVENT BREAKDOWN ===");
            Object.entries(eventSummary)
                .sort(([,a], [,b]) => b - a)
                .forEach(([event, count]) => {
                    console.log(`${event}: ${count}`);
                });
                
        } else {
            console.log("All successful orders in database are present in the CSV file!");
        }
        
        console.log("\n=== FILES CREATED ===");
        console.log(`1. ${outputDir}/successful_orders_missing_from_csv.csv - CSV format`);
        console.log(`2. ${outputDir}/successful_orders_missing_from_csv.xlsx - Excel format`);
        console.log(`3. ${outputDir}/missing_orders_analysis.xlsx - Analysis summary`);
        
        // Total amount calculation
        if (missingFromCSV.length > 0) {
            const totalAmount = missingFromCSV.reduce((sum, record) => sum + parseFloat(record['Total Amount']), 0);
            console.log(`\nTotal amount of missing orders: ₹${totalAmount.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error("Error in reverse analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the reverse analysis
findDatabaseOrdersNotInCSV();