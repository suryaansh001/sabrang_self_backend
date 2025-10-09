#!/usr/bin/env node

/**
 * Export All Schemas to CSV Script
 * 
 * This script exports all MongoDB schemas to individual CSV files:
 * - User
 * - Event  
 * - TeamComposition
 * - CheckoutOffer
 * - PromoCode
 * - Purchase
 * 
 * Usage: node export-all-schemas-to-csv.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const { User, Event, TeamComposition, CheckoutOffer, PromoCode, Purchase } = require('./models/models');
require('dotenv').config();

// Configuration
const EXPORT_DIR = './csv_exports';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

// Ensure export directory exists
function ensureExportDirectory() {
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
        console.log(`📁 Created export directory: ${EXPORT_DIR}`);
    }
}

// Connect to MongoDB
async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.mongodb || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        console.log('🔌 Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        
        console.log('✅ Connected to MongoDB successfully');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

// Flatten nested objects and arrays for CSV export
function flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
        if (obj[key] === null || obj[key] === undefined) {
            flattened[prefix + key] = '';
            continue;
        }
        
        if (Array.isArray(obj[key])) {
            // Handle arrays - convert to JSON string for CSV
            flattened[prefix + key] = JSON.stringify(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key].constructor === Object) {
            // Handle nested objects
            Object.assign(flattened, flattenObject(obj[key], prefix + key + '.'));
        } else if (obj[key] instanceof Date) {
            // Handle dates
            flattened[prefix + key] = obj[key].toISOString();
        } else if (typeof obj[key] === 'object' && obj[key]._id) {
            // Handle MongoDB ObjectIds
            flattened[prefix + key] = obj[key].toString();
        } else {
            flattened[prefix + key] = obj[key];
        }
    }
    
    return flattened;
}

// Export data to CSV
async function exportToCSV(data, filename, schemaName) {
    try {
        if (!data || data.length === 0) {
            console.log(`⚠️  No data found for ${schemaName} - creating empty CSV file`);
            const emptyFilePath = path.join(EXPORT_DIR, `${filename}_${TIMESTAMP}_EMPTY.csv`);
            fs.writeFileSync(emptyFilePath, `# No data found for ${schemaName} schema\n# Exported on: ${new Date().toISOString()}\n`);
            return emptyFilePath;
        }

        // Convert MongoDB documents to plain objects and flatten them
        const flattenedData = data.map(doc => {
            const plainObj = doc.toObject ? doc.toObject() : doc;
            return flattenObject(plainObj);
        });

        // Get all possible fields from all documents
        const allFields = new Set();
        flattenedData.forEach(doc => {
            Object.keys(doc).forEach(key => allFields.add(key));
        });

        const fields = Array.from(allFields).sort();

        // Configure CSV parser
        const json2csvParser = new Parser({
            fields: fields,
            includeEmptyRows: true,
            header: true
        });

        const csv = json2csvParser.parse(flattenedData);
        
        // Add metadata header
        const csvWithHeader = `# ${schemaName} Schema Export\n# Exported on: ${new Date().toISOString()}\n# Total records: ${data.length}\n# Fields: ${fields.length}\n\n${csv}`;
        
        const filePath = path.join(EXPORT_DIR, `${filename}_${TIMESTAMP}.csv`);
        fs.writeFileSync(filePath, csvWithHeader);
        
        console.log(`✅ Exported ${data.length} ${schemaName} records to: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error(`❌ Error exporting ${schemaName} to CSV:`, error.message);
        throw error;
    }
}

// Export Users
async function exportUsers() {
    try {
        console.log('\n📊 Exporting Users...');
        const users = await User.find({}).lean();
        console.log(`📈 Found ${users.length} user records`);
        
        return await exportToCSV(users, 'users', 'User');
    } catch (error) {
        console.error('❌ Error exporting users:', error.message);
        throw error;
    }
}

// Export Events
async function exportEvents() {
    try {
        console.log('\n📊 Exporting Events...');
        const events = await Event.find({}).lean();
        console.log(`📈 Found ${events.length} event records`);
        
        return await exportToCSV(events, 'events', 'Event');
    } catch (error) {
        console.error('❌ Error exporting events:', error.message);
        throw error;
    }
}

// Export Team Compositions
async function exportTeamCompositions() {
    try {
        console.log('\n📊 Exporting Team Compositions...');
        const teamCompositions = await TeamComposition.find({}).lean();
        console.log(`📈 Found ${teamCompositions.length} team composition records`);
        
        return await exportToCSV(teamCompositions, 'team_compositions', 'TeamComposition');
    } catch (error) {
        console.error('❌ Error exporting team compositions:', error.message);
        throw error;
    }
}

// Export Checkout Offers
async function exportCheckoutOffers() {
    try {
        console.log('\n📊 Exporting Checkout Offers...');
        const checkoutOffers = await CheckoutOffer.find({}).lean();
        console.log(`📈 Found ${checkoutOffers.length} checkout offer records`);
        
        return await exportToCSV(checkoutOffers, 'checkout_offers', 'CheckoutOffer');
    } catch (error) {
        console.error('❌ Error exporting checkout offers:', error.message);
        throw error;
    }
}

// Export Promo Codes
async function exportPromoCodes() {
    try {
        console.log('\n📊 Exporting Promo Codes...');
        const promoCodes = await PromoCode.find({}).lean();
        console.log(`📈 Found ${promoCodes.length} promo code records`);
        
        return await exportToCSV(promoCodes, 'promo_codes', 'PromoCode');
    } catch (error) {
        console.error('❌ Error exporting promo codes:', error.message);
        throw error;
    }
}

// Export Purchases
async function exportPurchases() {
    try {
        console.log('\n📊 Exporting Purchases...');
        const purchases = await Purchase.find({}).lean();
        console.log(`📈 Found ${purchases.length} purchase records`);
        
        return await exportToCSV(purchases, 'purchases', 'Purchase');
    } catch (error) {
        console.error('❌ Error exporting purchases:', error.message);
        throw error;
    }
}

// Generate summary report
function generateSummaryReport(exportResults) {
    const summaryPath = path.join(EXPORT_DIR, `export_summary_${TIMESTAMP}.txt`);
    
    let summary = `CSV Export Summary Report\n`;
    summary += `==========================\n`;
    summary += `Export Date: ${new Date().toISOString()}\n`;
    summary += `Export Directory: ${EXPORT_DIR}\n\n`;
    
    summary += `Files Generated:\n`;
    summary += `----------------\n`;
    
    exportResults.forEach(result => {
        if (result.success) {
            summary += `✅ ${result.schema}: ${result.filePath}\n`;
        } else {
            summary += `❌ ${result.schema}: FAILED - ${result.error}\n`;
        }
    });
    
    summary += `\nTotal Files: ${exportResults.filter(r => r.success).length}/${exportResults.length}\n`;
    summary += `Export completed at: ${new Date().toISOString()}\n`;
    
    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📋 Summary report generated: ${summaryPath}`);
    
    return summaryPath;
}

// Main export function
async function exportAllSchemas() {
    console.log('🚀 Starting comprehensive CSV export of all schemas...\n');
    
    const exportResults = [];
    
    try {
        // Ensure directory exists
        ensureExportDirectory();
        
        // Connect to database
        const connected = await connectToDatabase();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }
        
        // Export each schema
        const exportTasks = [
            { name: 'User', func: exportUsers },
            { name: 'Event', func: exportEvents },
            { name: 'TeamComposition', func: exportTeamCompositions },
            { name: 'CheckoutOffer', func: exportCheckoutOffers },
            { name: 'PromoCode', func: exportPromoCodes },
            { name: 'Purchase', func: exportPurchases }
        ];
        
        for (const task of exportTasks) {
            try {
                const filePath = await task.func();
                exportResults.push({
                    schema: task.name,
                    success: true,
                    filePath: filePath
                });
            } catch (error) {
                exportResults.push({
                    schema: task.name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Generate summary report
        generateSummaryReport(exportResults);
        
        console.log('\n🎉 CSV Export Complete!');
        console.log('======================');
        console.log(`📁 Export directory: ${EXPORT_DIR}`);
        console.log(`📊 Successfully exported: ${exportResults.filter(r => r.success).length}/${exportResults.length} schemas`);
        
        const failedExports = exportResults.filter(r => !r.success);
        if (failedExports.length > 0) {
            console.log('\n⚠️  Failed exports:');
            failedExports.forEach(result => {
                console.log(`   ❌ ${result.schema}: ${result.error}`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ Export failed:', error.message);
        throw error;
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n👋 Disconnected from database');
        }
    }
}

// Check database connection and collections
async function checkDatabaseInfo() {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log('\n📊 Database Information:');
        console.log('======================');
        console.log(`Database: ${db.databaseName}`);
        console.log(`Collections found: ${collections.length}`);
        
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });
        
        console.log();
        
        // Check document counts for each schema
        const models = [
            { name: 'Users', model: User },
            { name: 'Events', model: Event },
            { name: 'TeamCompositions', model: TeamComposition },
            { name: 'CheckoutOffers', model: CheckoutOffer },
            { name: 'PromoCodes', model: PromoCode },
            { name: 'Purchases', model: Purchase }
        ];
        
        console.log('📈 Document Counts:');
        console.log('==================');
        
        for (const { name, model } of models) {
            try {
                const count = await model.countDocuments();
                console.log(`${name}: ${count} documents`);
            } catch (error) {
                console.log(`${name}: Error counting - ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking database info:', error.message);
    }
}

// Main execution
async function main() {
    try {
        console.log('🎯 CSV Export Tool for All Schemas');
        console.log('==================================');
        
        // Connect and check database info
        const connected = await connectToDatabase();
        if (!connected) {
            process.exit(1);
        }
        
        await checkDatabaseInfo();
        
        // Disconnect temporarily to restart the export process
        await mongoose.disconnect();
        
        // Run the export
        await exportAllSchemas();
        
        console.log('\n✨ All done! Check the csv_exports directory for your files.');
        
    } catch (error) {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    }
}

// Install json2csv if not installed
function checkDependencies() {
    try {
        require('json2csv');
    } catch (error) {
        console.log('📦 Installing required dependency: json2csv');
        console.log('Run: npm install json2csv');
        console.log('Then run this script again.');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    checkDependencies();
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { 
    exportAllSchemas, 
    exportUsers, 
    exportEvents, 
    exportTeamCompositions, 
    exportCheckoutOffers, 
    exportPromoCodes, 
    exportPurchases 
};