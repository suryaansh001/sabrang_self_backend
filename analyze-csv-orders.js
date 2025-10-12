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

// Function to read CSV file
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

// Function to create Excel file
function createExcelFile(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
    console.log(`Excel file created: ${filename}`);
}

// Main function to analyze CSV orders
async function analyzeCSVOrders() {
    try {
        await connectToMongoDB();
        
        // Read CSV file
        console.log("Reading CSV file...");
        const csvData = await readCSVFile('success.csv');
        console.log(`Total records in CSV: ${csvData.length}`);
        
        // Filter payments greater than 2 INR
        const filteredData = csvData.filter(row => {
            const amount = parseFloat(row['Order Amount']);
            return amount > 2;
        });
        console.log(`Records with amount > 2 INR: ${filteredData.length}`);
        
        // Arrays to store results
        const foundInDatabase = [];
        const notFoundInDatabase = [];
        let processedCount = 0;
        
        console.log("Processing orders...");
        
        // Process each order
        for (const row of filteredData) {
            const orderId = row['Order Id'];
            const cashfreeOrderId = row['Cashfree Order ID'];
            const orderAmount = parseFloat(row['Order Amount']);
            const customerPhone = row['Customer Phone'];
            const transactionTime = row['Transaction Time'];
            const paymentMode = row['Payment Mode'];
            const transactionStatus = row['Transaction Status'];
            const transactionAmount = parseFloat(row['Transaction Amount']);
            
            // Try to find in Purchase schema by orderId or cashfreeOrderId
            let purchase = null;
            if (orderId) {
                purchase = await Purchase.findOne({ orderId: orderId });
            }
            if (!purchase && cashfreeOrderId) {
                purchase = await Purchase.findOne({ cashfreeOrderId: cashfreeOrderId });
            }
            
            if (purchase) {
                // Found in database - get user details
                let user = null;
                if (purchase.userId) {
                    user = await User.findById(purchase.userId);
                }
                
                const recordData = {
                    'Order ID': orderId,
                    'Cashfree Order ID': cashfreeOrderId,
                    'Order Amount': orderAmount,
                    'Transaction Amount': transactionAmount,
                    'Customer Phone': customerPhone,
                    'Transaction Time': transactionTime,
                    'Payment Mode': paymentMode,
                    'Transaction Status': transactionStatus,
                    'Purchase ID': purchase._id.toString(),
                    'User ID': purchase.userId ? purchase.userId.toString() : 'N/A',
                    'User Name': user ? user.name : purchase.userDetails?.name || 'N/A',
                    'User Email': user ? user.email : purchase.userDetails?.email || 'N/A',
                    'User Contact': user ? user.contactNo : purchase.userDetails?.contactNo || 'N/A',
                    'User Events': user ? user.events.join(', ') : 'N/A',
                    'Purchase Status': purchase.paymentStatus,
                    'User Registered': purchase.userRegistered,
                    'QR Generated': purchase.qrGenerated,
                    'Email Sent': purchase.emailSent,
                    'Items': purchase.items.map(item => `${item.itemName} (₹${item.price})`).join('; '),
                    'Total Amount': purchase.totalAmount,
                    'Purchase Date': purchase.purchaseDate,
                    'User Validated': user ? user.isvalidated : 'N/A',
                    'University': user ? user.universityName : purchase.userDetails?.universityName || 'N/A'
                };
                
                foundInDatabase.push(recordData);
            } else {
                // Not found in database
                notFoundInDatabase.push({
                    'Order ID': orderId,
                    'Cashfree Order ID': cashfreeOrderId,
                    'Order Amount': orderAmount,
                    'Transaction Amount': transactionAmount,
                    'Customer Phone': customerPhone,
                    'Transaction Time': transactionTime,
                    'Payment Mode': paymentMode,
                    'Transaction Status': transactionStatus,
                    'Status': 'Not found in Purchase schema'
                });
            }
            
            processedCount++;
            if (processedCount % 50 === 0) {
                console.log(`Processed ${processedCount}/${filteredData.length} orders...`);
            }
        }
        
        console.log("\n=== ANALYSIS RESULTS ===");
        console.log(`Total orders processed: ${processedCount}`);
        console.log(`Found in database: ${foundInDatabase.length}`);
        console.log(`Not found in database: ${notFoundInDatabase.length}`);
        
        // Create Excel files
        if (foundInDatabase.length > 0) {
            createExcelFile(foundInDatabase, 'orders_found_in_database.xlsx');
        }
        
        if (notFoundInDatabase.length > 0) {
            createExcelFile(notFoundInDatabase, 'orders_not_found_in_database.xlsx');
        }
        
        // Create summary report
        const summary = [{
            'Metric': 'Total CSV Records',
            'Count': csvData.length
        }, {
            'Metric': 'Records with Amount > 2 INR',
            'Count': filteredData.length
        }, {
            'Metric': 'Found in Database',
            'Count': foundInDatabase.length
        }, {
            'Metric': 'Not Found in Database',
            'Count': notFoundInDatabase.length
        }, {
            'Metric': 'Database Match Rate',
            'Count': `${((foundInDatabase.length / filteredData.length) * 100).toFixed(2)}%`
        }];
        
        createExcelFile(summary, 'analysis_summary.xlsx');
        
        console.log("\n=== FILES CREATED ===");
        console.log("1. orders_found_in_database.xlsx - Orders with user details and purchase info");
        console.log("2. orders_not_found_in_database.xlsx - Orders not found in database");
        console.log("3. analysis_summary.xlsx - Summary statistics");
        
        // Additional insights
        if (foundInDatabase.length > 0) {
            const validatedUsers = foundInDatabase.filter(record => record['User Validated'] === true).length;
            const qrGenerated = foundInDatabase.filter(record => record['QR Generated'] === true).length;
            const emailsSent = foundInDatabase.filter(record => record['Email Sent'] === true).length;
            
            console.log("\n=== ADDITIONAL INSIGHTS ===");
            console.log(`Users validated: ${validatedUsers}/${foundInDatabase.length}`);
            console.log(`QR codes generated: ${qrGenerated}/${foundInDatabase.length}`);
            console.log(`Emails sent: ${emailsSent}/${foundInDatabase.length}`);
        }
        
    } catch (error) {
        console.error("Error in analysis:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    }
}

// Run the analysis
analyzeCSVOrders();