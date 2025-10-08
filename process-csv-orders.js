/**
 * Script to process cashfreeFinal.csv and ensure user entries and QR codes
 * 
 * This script will:
 * 1. Read orders from cashfreeFinal.csv
 * 2. Check which orders exist in purchases schema
 * 3. For existing orders, ensure user entries exist
 * 4. Generate QR codes for users who don't have them
 * 5. List orders that are NOT in purchases schema
 */

const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { Purchase, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const bcrypt = require('bcrypt');

// Statistics tracking
let stats = {
    totalCSVOrders: 0,
    ordersInDB: 0,
    ordersNotInDB: 0,
    usersCreated: 0,
    usersUpdated: 0,
    qrGenerated: 0,
    errors: 0,
    csvOrderIds: [],
    ordersNotInDBList: [],
    errorDetails: []
};

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.mongodb, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

async function readCSVFile() {
    return new Promise((resolve, reject) => {
        const orders = [];
        
        console.log('📖 Reading cashfreeFinal.csv...');
        
        fs.createReadStream('cashfreeFinal.csv')
            .pipe(csv())
            .on('data', (row) => {
                // Only process successful transactions
                if (row['Transaction Status'] === 'SUCCESS') {
                    orders.push({
                        orderId: row['Order Id']?.trim(),
                        cashfreeOrderId: row['Cashfree Order ID']?.trim(),
                        orderAmount: parseFloat(row['Order Amount']) || 0,
                        customerPhone: row['Customer Phone']?.trim(),
                        transactionTime: row['Transaction Time']?.trim(),
                        customerReferenceId: row['Customer Reference ID']?.trim()
                    });
                }
            })
            .on('end', () => {
                stats.totalCSVOrders = orders.length;
                stats.csvOrderIds = orders.map(o => o.orderId).filter(Boolean);
                console.log(`✅ Read ${orders.length} successful orders from CSV`);
                resolve(orders);
            })
            .on('error', (error) => {
                console.error('❌ Error reading CSV:', error);
                reject(error);
            });
    });
}

async function checkOrdersInDatabase(csvOrders) {
    console.log('\n🔍 Checking which orders exist in purchases database...');
    
    const orderIds = csvOrders.map(o => o.orderId).filter(Boolean);
    const cashfreeOrderIds = csvOrders.map(o => o.cashfreeOrderId).filter(Boolean);
    
    // Find existing purchases
    const existingPurchases = await Purchase.find({
        $or: [
            { orderId: { $in: orderIds } },
            { cashfreeOrderId: { $in: cashfreeOrderIds } }
        ]
    }).populate('userId mainPersonId');
    
    stats.ordersInDB = existingPurchases.length;
    
    // Find orders not in database
    const existingOrderIds = new Set();
    existingPurchases.forEach(purchase => {
        if (purchase.orderId) existingOrderIds.add(purchase.orderId);
        if (purchase.cashfreeOrderId) existingOrderIds.add(purchase.cashfreeOrderId);
    });
    
    const ordersNotInDB = csvOrders.filter(csvOrder => 
        !existingOrderIds.has(csvOrder.orderId) && 
        !existingOrderIds.has(csvOrder.cashfreeOrderId)
    );
    
    stats.ordersNotInDB = ordersNotInDB.length;
    stats.ordersNotInDBList = ordersNotInDB.map(o => ({
        orderId: o.orderId,
        cashfreeOrderId: o.cashfreeOrderId,
        amount: o.orderAmount,
        phone: o.customerPhone,
        time: o.transactionTime
    }));
    
    console.log(`📊 Orders found in database: ${stats.ordersInDB}`);
    console.log(`📊 Orders NOT found in database: ${stats.ordersNotInDB}`);
    
    return { existingPurchases, ordersNotInDB };
}

async function ensureUserExists(purchase, csvOrder) {
    try {
        console.log(`\n👤 Processing purchase: ${purchase.orderId || purchase.cashfreeOrderId}`);
        
        let user = purchase.userId || purchase.mainPersonId;
        
        if (!user && purchase.userDetails?.email) {
            // Try to find user by email from purchase details
            user = await User.findOne({ 
                email: purchase.userDetails.email.toLowerCase().trim() 
            });
            
            if (user) {
                console.log(`✅ Found existing user by email: ${user.email}`);
                // Link purchase to user
                purchase.userId = user._id;
                purchase.mainPersonId = user._id;
                await purchase.save();
            }
        }
        
        if (!user) {
            // Create user from purchase details
            const userData = purchase.userDetails;
            if (!userData || !userData.email) {
                console.log(`⚠️ No user details found in purchase ${purchase.orderId}`);
                return null;
            }
            
            console.log(`👤 Creating new user: ${userData.name} (${userData.email})`);
            
            const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
            
            user = new User({
                name: userData.name,
                email: userData.email.toLowerCase().trim(),
                contactNo: userData.contactNo || csvOrder.customerPhone || '',
                password: hashedPassword,
                gender: userData.gender || '',
                age: userData.age || null,
                universityName: userData.universityName || '',
                address: userData.address || '',
                referralCode: userData.referralCode || '',
                events: purchase.items?.filter(item => item.type === 'event')?.map(item => item.itemName) || [],
                userType: 'participant',
                isvalidated: true,
                hasEntered: false,
                emailSent: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            await user.save();
            
            // Link purchase to user
            purchase.userId = user._id;
            purchase.mainPersonId = user._id;
            purchase.userRegistered = true;
            await purchase.save();
            
            console.log(`✅ User created successfully: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Events: ${user.events.join(', ')}`);
            stats.usersCreated++;
        } else {
            console.log(`✅ User already exists: ${user.name} (${user.email})`);
            
            // Update events if needed
            const purchaseEvents = purchase.items?.filter(item => item.type === 'event')?.map(item => item.itemName) || [];
            let eventsAdded = false;
            
            purchaseEvents.forEach(eventName => {
                if (eventName && !user.events.includes(eventName)) {
                    user.events.push(eventName);
                    eventsAdded = true;
                }
            });
            
            if (eventsAdded) {
                user.isvalidated = true;
                await user.save();
                console.log(`✅ Added new events to user: ${purchaseEvents.join(', ')}`);
                stats.usersUpdated++;
            }
        }
        
        return user;
        
    } catch (error) {
        console.error(`❌ Error processing user for purchase ${purchase.orderId}:`, error.message);
        stats.errors++;
        stats.errorDetails.push({
            orderId: purchase.orderId,
            error: error.message
        });
        return null;
    }
}

async function generateQRForUser(user) {
    try {
        // Check if user already has QR code
        if (user.qrCodeBase64 && user.qrPath) {
            console.log(`   ✅ User already has QR code`);
            return true;
        }
        
        console.log(`   🔄 Generating QR code for: ${user.name}`);
        
        const qrData = {
            name: user.name,
            email: user.email,
            events: user.events || [],
            userId: user._id
        };
        
        const qrCodeBase64 = await generateUserQRCode(user._id, qrData);
        
        if (qrCodeBase64) {
            const qrPath = `qr_${user._id}.png`;
            
            await User.findByIdAndUpdate(user._id, {
                qrCodeBase64: qrCodeBase64,
                qrPath: qrPath,
                updatedAt: new Date()
            });
            
            console.log(`   ✅ QR code generated and saved`);
            console.log(`   📁 QR Path: ${qrPath}`);
            stats.qrGenerated++;
            return true;
        } else {
            console.log(`   ❌ Failed to generate QR code`);
            return false;
        }
        
    } catch (error) {
        console.error(`   ❌ QR generation error for ${user.email}:`, error.message);
        return false;
    }
}

async function processOrders() {
    try {
        console.log('🎯 CSV ORDER PROCESSING SCRIPT');
        console.log('==============================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        console.log(`📄 File: cashfreeFinal.csv\n`);

        // Connect to database
        await connectToDatabase();

        // Read CSV file
        const csvOrders = await readCSVFile();

        // Check which orders exist in database
        const { existingPurchases, ordersNotInDB } = await checkOrdersInDatabase(csvOrders);

        // Process existing purchases
        if (existingPurchases.length > 0) {
            console.log('\n🚀 Processing existing purchases...');
            console.log('='.repeat(60));

            for (let i = 0; i < existingPurchases.length; i++) {
                const purchase = existingPurchases[i];
                const csvOrder = csvOrders.find(o => 
                    o.orderId === purchase.orderId || 
                    o.cashfreeOrderId === purchase.cashfreeOrderId
                );

                console.log(`\n[${i + 1}/${existingPurchases.length}] Processing purchase...`);
                
                // Ensure user exists
                const user = await ensureUserExists(purchase, csvOrder);
                
                if (user) {
                    // Generate QR code if needed
                    await generateQRForUser(user);
                }

                // Small delay to prevent overwhelming the system
                if (i < existingPurchases.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        // Final summary
        console.log('\n🎉 PROCESSING COMPLETED');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   📄 Total orders in CSV: ${stats.totalCSVOrders}`);
        console.log(`   ✅ Orders found in database: ${stats.ordersInDB}`);
        console.log(`   ❌ Orders NOT in database: ${stats.ordersNotInDB}`);
        console.log(`   👤 Users created: ${stats.usersCreated}`);
        console.log(`   🔄 Users updated: ${stats.usersUpdated}`);
        console.log(`   🎫 QR codes generated: ${stats.qrGenerated}`);
        console.log(`   ❌ Errors: ${stats.errors}`);

        // List orders not in database
        if (stats.ordersNotInDBList.length > 0) {
            console.log('\n🚨 ORDERS NOT FOUND IN DATABASE:');
            console.log('-'.repeat(60));
            stats.ordersNotInDBList.forEach((order, index) => {
                console.log(`${index + 1}. Order ID: ${order.orderId}`);
                console.log(`   Cashfree ID: ${order.cashfreeOrderId || 'N/A'}`);
                console.log(`   Amount: ₹${order.amount}`);
                console.log(`   Phone: ${order.phone || 'N/A'}`);
                console.log(`   Time: ${order.time}`);
                console.log('');
            });
            
            // Save missing orders to file
            const missingOrdersData = stats.ordersNotInDBList.map(order => 
                `${order.orderId},${order.cashfreeOrderId || ''},${order.amount},${order.phone || ''},${order.time}`
            ).join('\n');
            
            const header = 'Order ID,Cashfree Order ID,Amount,Phone,Transaction Time\n';
            fs.writeFileSync('missing_orders.csv', header + missingOrdersData);
            console.log('💾 Missing orders saved to: missing_orders.csv');
        }

        // Error details
        if (stats.errorDetails.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            console.log('-'.repeat(60));
            stats.errorDetails.forEach((error, index) => {
                console.log(`${index + 1}. Order: ${error.orderId} - ${error.error}`);
            });
        }

        console.log(`\n📅 Completed at: ${new Date().toLocaleString()}`);

    } catch (error) {
        console.error('💥 Script execution failed:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        try {
            await mongoose.connection.close();
            console.log('\n🔌 Database connection closed');
        } catch (disconnectError) {
            console.error('❌ Error closing database connection:', disconnectError);
        }
        process.exit(0);
    }
}

// Load environment variables
require('dotenv').config();

// Validate environment variables
if (!process.env.mongodb) {
    console.error('❌ Error: mongodb environment variable not found');
    process.exit(1);
}

// Check if CSV file exists
if (!fs.existsSync('cashfreeFinal.csv')) {
    console.error('❌ Error: cashfreeFinal.csv file not found');
    process.exit(1);
}

// Run the script
processOrders();