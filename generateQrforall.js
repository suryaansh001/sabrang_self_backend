/**
 * Script to generate QR codes for all users who don't have QR codes
 * 
 * This script will:
 * 1. Find all users without QR codes
 * 2. Generate QR codes for them
 * 3. Update their records in the database
 * 4. Provide detailed progress tracking
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');

// Statistics tracking
let stats = {
    totalUsers: 0,
    usersWithoutQR: 0,
    qrGenerated: 0,
    errors: 0,
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

async function findUsersWithoutQR() {
    try {
        console.log('\n🔍 Finding users without QR codes...');
        
        // Find users who don't have QR codes
        const usersWithoutQR = await User.find({
            $or: [
                { qrCodeBase64: { $exists: false } },
                { qrCodeBase64: null },
                { qrCodeBase64: '' },
                { qrPath: { $exists: false } },
                { qrPath: null },
                { qrPath: '' }
            ]
        }).select('_id name email contactNo qrCodeBase64 qrPath events createdAt');

        stats.totalUsers = await User.countDocuments();
        stats.usersWithoutQR = usersWithoutQR.length;

        console.log(`📊 Total users in database: ${stats.totalUsers}`);
        console.log(`🎯 Users without QR codes: ${stats.usersWithoutQR}`);

        return usersWithoutQR;
    } catch (error) {
        console.error('❌ Error finding users:', error);
        throw error;
    }
}

async function generateQRForUser(user, index, total) {
    try {
        console.log(`\n[${index + 1}/${total}] Processing: ${user.name} (${user.email})`);
        console.log(`   Events: ${user.events?.join(', ') || 'No events'}`);
        console.log(`   User ID: ${user._id}`);
        
        // Check if user already has QR codes
        if (user.qrCodeBase64 && user.qrPath) {
            console.log(`⏭️  User already has QR codes, skipping...`);
            return false;
        }

        // Generate QR code
        console.log('🔄 Generating QR code...');
        
        // Prepare QR data
        const qrData = {
            name: user.name,
            email: user.email,
            events: user.events || [],
            userId: user._id
        };
        
        // Call QR generation service
        const qrCodeBase64 = await generateUserQRCode(user._id, qrData);
        
        if (qrCodeBase64) {
            // Generate QR path
            const qrPath = `qr_${user._id}.png`;
            
            // Update user in database
            await User.findByIdAndUpdate(user._id, {
                qrCodeBase64: qrCodeBase64,
                qrPath: qrPath,
                updatedAt: new Date()
            });
            
            console.log(`✅ QR code generated and saved successfully`);
            console.log(`   📁 QR Path: ${qrPath}`);
            console.log(`   📏 QR Base64 length: ${qrCodeBase64.length} characters`);
            stats.qrGenerated++;
            return true;
        } else {
            console.log(`❌ Failed to generate QR code - null response`);
            stats.errors++;
            stats.errorDetails.push({
                user: `${user.name} (${user.email})`,
                error: 'QR generation returned null'
            });
            return false;
        }
    } catch (error) {
        console.error(`❌ Error processing user ${user.name} (${user.email}):`, error.message);
        stats.errors++;
        stats.errorDetails.push({
            user: `${user.name} (${user.email})`,
            error: error.message
        });
        return false;
    }
}

async function generateQRForAllUsers() {
    try {
        console.log('🎯 BULK QR CODE GENERATION SCRIPT');
        console.log('=================================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        console.log(`🎯 Target: All users without QR codes\n`);

        // Connect to database
        await connectToDatabase();

        // Find users without QR codes
        const usersWithoutQR = await findUsersWithoutQR();

        if (usersWithoutQR.length === 0) {
            console.log('\n🎉 All users already have QR codes! Nothing to do.');
            return;
        }

        console.log('\n🚀 Starting QR code generation...');
        console.log('='.repeat(60));

        // Process each user
        for (let i = 0; i < usersWithoutQR.length; i++) {
            const user = usersWithoutQR[i];
            await generateQRForUser(user, i, usersWithoutQR.length);
            
            // Add a small delay to prevent overwhelming the system
            if (i < usersWithoutQR.length - 1) {
                console.log('⏳ Waiting 1 second before next user...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
        }

        // Final summary
        console.log('\n🎉 QR CODE GENERATION COMPLETED');
        console.log('='.repeat(60));
        console.log(`� Processing Summary:`);
        console.log(`   �👥 Total users in database: ${stats.totalUsers}`);
        console.log(`   🎯 Users without QR codes found: ${stats.usersWithoutQR}`);
        console.log(`   ✅ QR codes successfully generated: ${stats.qrGenerated}`);
        console.log(`   ❌ Errors encountered: ${stats.errors}`);

        if (stats.errorDetails.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            console.log('-'.repeat(60));
            stats.errorDetails.forEach((error, index) => {
                console.log(`${index + 1}. ${error.user}: ${error.error}`);
            });
        }

        const successRate = stats.usersWithoutQR > 0 ? 
            ((stats.qrGenerated / stats.usersWithoutQR) * 100).toFixed(1) : 0;
        
        console.log(`\n📈 Success Rate: ${successRate}%`);
        console.log(`📅 Completed at: ${new Date().toLocaleString()}`);
        
        if (stats.qrGenerated > 0) {
            console.log('\n� QR code generation completed successfully!');
            console.log('💡 All users can now access their QR codes via:');
            console.log('   - Mobile app QR display');
            console.log('   - API endpoint: /qrcode/{userId}');
            console.log('   - Team member QR display');
        }

    } catch (error) {
        console.error('💥 Script failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
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

// Run the script
generateQRForAllUsers();