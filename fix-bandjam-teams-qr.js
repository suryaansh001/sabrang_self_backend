const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Load environment variables
require('dotenv').config();

// MongoDB connection
async function connectDB() {
    try {
        const mongoUri = process.env.mongodb || process.env.MONGODB_URI || process.env.MONGODB_URL;
        await mongoose.connect(mongoUri);
        console.log('📊 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    phoneNumber: String,
    college: String,
    events: [String],
    isvalidated: { type: Boolean, default: false },
    qrcode: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// TeamComposition Schema
const teamCompositionSchema = new mongoose.Schema({
    eventName: String,
    teamName: String,
    teamLeader: {
        userId: mongoose.Schema.Types.ObjectId,
        name: String,
        email: String,
        hasEntered: { type: Boolean, default: false }
    },
    teamMembers: [{
        userId: mongoose.Schema.Types.ObjectId,
        name: String,
        email: String,
        hasEntered: { type: Boolean, default: false },
        role: String
    }],
    totalMembers: Number,
    maxTeamSize: Number,
    registrationComplete: { type: Boolean, default: false },
    teamEntryStatus: {
        totalEntered: { type: Number, default: 0 },
        pendingEntry: { type: Number, default: 0 },
        allEntered: { type: Boolean, default: false }
    },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    purchaseId: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const TeamComposition = mongoose.model('TeamComposition', teamCompositionSchema);

// QR Code generation function
const generateQRCode = async (userId) => {
    try {
        console.log(`🔍 Cleaned user ID for QR: ${userId}`);
        const qrData = userId.toString();
        console.log(`🔍 QR data to encode: ${qrData}`);
        console.log(`🔍 Generating QR code with data: "${qrData}" (length: ${qrData.length})`);
        
        const qrCodeBase64 = await QRCode.toDataURL(qrData, {
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 256
        });
        
        console.log(`🔍 QR code generated successfully, base64 length: ${qrCodeBase64.length}`);
        console.log(`✅ QR code generated as base64 for user: ${userId}, base64 length: ${qrCodeBase64.length}`);
        
        return qrCodeBase64;
    } catch (error) {
        console.error(`❌ Error generating QR code for user ${userId}:`, error);
        throw error;
    }
};

// Function to process a single user
const processUser = async (userId, name, email) => {
    try {
        console.log(`\n🔍 Processing: ${name} (${email})`);
        
        const user = await User.findById(userId);
        if (!user) {
            console.log(`   ❌ User not found in database: ${userId}`);
            return { success: false, reason: 'USER_NOT_FOUND' };
        }
        
        console.log(`   👤 Found: ${user.name}`);
        console.log(`   📊 Current Status: validated=${user.isvalidated}, hasQR=${!!user.qrcode}`);
        
        let updated = false;
        
        // Set validation to true if not already
        if (!user.isvalidated) {
            console.log(`   🔄 Setting validation to true`);
            user.isvalidated = true;
            updated = true;
        }
        
        // Generate QR code if missing
        if (!user.qrcode) {
            console.log(`   📱 QR code missing, generating...`);
            console.log(`   📱 Generating QR code for ${user.name}...`);
            
            const qrCode = await generateQRCode(user._id);
            user.qrcode = qrCode;
            updated = true;
            
            console.log(`   ✅ QR code generated successfully`);
        }
        
        // Save if any updates were made
        if (updated) {
            user.updatedAt = new Date();
            await user.save();
            console.log(`   ✅ User updated successfully`);
        } else {
            console.log(`   ✅ User already properly configured`);
        }
        
        return { success: true, updated };
        
    } catch (error) {
        console.error(`   ❌ Error processing user ${name}:`, error);
        return { success: false, reason: 'PROCESSING_ERROR', error: error.message };
    }
};

// Function to process a team
const processTeam = async (team) => {
    console.log(`\n🏆 Processing Team: ${team.teamName} - ${team.eventName}`);
    console.log(`💳 Payment Status: ${team.paymentStatus}`);
    console.log(`👥 Total Members: ${team.totalMembers}`);
    
    const results = {
        teamName: team.teamName,
        eventName: team.eventName,
        paymentStatus: team.paymentStatus,
        processed: [],
        failed: []
    };
    
    // Process team leader
    console.log(`\n👑 Processing Team Leader:`);
    const leaderResult = await processUser(
        team.teamLeader.userId,
        team.teamLeader.name,
        team.teamLeader.email
    );
    
    if (leaderResult.success) {
        results.processed.push({
            name: team.teamLeader.name,
            email: team.teamLeader.email,
            role: 'leader',
            updated: leaderResult.updated
        });
    } else {
        results.failed.push({
            name: team.teamLeader.name,
            email: team.teamLeader.email,
            role: 'leader',
            reason: leaderResult.reason
        });
    }
    
    // Process team members
    console.log(`\n👥 Processing Team Members:`);
    for (const member of team.teamMembers) {
        const memberResult = await processUser(
            member.userId,
            member.name,
            member.email
        );
        
        if (memberResult.success) {
            results.processed.push({
                name: member.name,
                email: member.email,
                role: 'member',
                updated: memberResult.updated
            });
        } else {
            results.failed.push({
                name: member.name,
                email: member.email,
                role: 'member',
                reason: memberResult.reason
            });
        }
    }
    
    return results;
};

// Main function
const main = async () => {
    try {
        await connectDB();
        
        console.log('🎯 Starting BANDJAM Teams QR Code Generation');
        console.log('=' .repeat(50));
        
        // Target team IDs from the provided data
        const targetTeamIds = [
            '68e6afbcc91c5f5a4ace5f4e', // 200ft.
            '68e78a53c51438c537efcb47', // Pratham Dubey's Team
            '68e7dc4c1c86ecaf68204f9b', // Ronsa's Team (first)
            '68e7e50b1c86ecaf68205e76', // Jatin Singh's Team
            '68e7fab00ce1bb80969eb319'  // Ronsa's Team (second)
        ];
        
        const allResults = [];
        let totalProcessed = 0;
        let totalFailed = 0;
        let totalUpdated = 0;
        
        for (const teamId of targetTeamIds) {
            try {
                const team = await TeamComposition.findById(teamId);
                if (!team) {
                    console.log(`❌ Team not found: ${teamId}`);
                    continue;
                }
                
                const teamResults = await processTeam(team);
                allResults.push(teamResults);
                
                totalProcessed += teamResults.processed.length;
                totalFailed += teamResults.failed.length;
                totalUpdated += teamResults.processed.filter(p => p.updated).length;
                
            } catch (error) {
                console.error(`❌ Error processing team ${teamId}:`, error);
            }
        }
        
        // Summary
        console.log('\n🎉 BANDJAM TEAMS QR GENERATION COMPLETED');
        console.log('=' .repeat(50));
        console.log(`📊 Results:`);
        console.log(`   Teams Processed: ${allResults.length}`);
        console.log(`   Users Successfully Processed: ${totalProcessed}`);
        console.log(`   Users Failed: ${totalFailed}`);
        console.log(`   Users Updated: ${totalUpdated}`);
        
        // Detailed results
        console.log('\n📋 Detailed Team Results:');
        for (const result of allResults) {
            console.log(`\n🏆 ${result.teamName} (${result.eventName})`);
            console.log(`   💳 Payment: ${result.paymentStatus}`);
            console.log(`   ✅ Processed: ${result.processed.length}`);
            console.log(`   ❌ Failed: ${result.failed.length}`);
            
            if (result.failed.length > 0) {
                console.log(`   Failed users:`);
                result.failed.forEach(f => {
                    console.log(`     - ${f.name} (${f.email}) - ${f.reason}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        console.log('\n📴 Disconnecting from MongoDB');
        await mongoose.disconnect();
        process.exit(0);
    }
};

// Handle script arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('Use --execute flag to actually process the teams');
    console.log('Command: node fix-bandjam-teams-qr.js --execute');
    process.exit(0);
}

// Run the script
main().catch(console.error);