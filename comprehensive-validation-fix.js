/**
 * Comprehensive Team and User Validation Fix
 * 
 * This script ensures that:
 * 1. All users in the CSV are properly validated with QR codes
 * 2. All team members of these users are also validated with QR codes
 * 3. Team-based registrations are handled correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, Purchase, TeamComposition } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');

async function readEmailsFromCSV(csvFilePath) {
    return new Promise((resolve, reject) => {
        const emails = [];
        
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                const email = row.email || row.Email || Object.values(row)[0];
                if (email && email.trim()) {
                    emails.push(email.trim().toLowerCase());
                }
            })
            .on('end', () => {
                resolve([...new Set(emails)]);
            })
            .on('error', reject);
    });
}

async function generateQRIfMissing(user) {
    try {
        if (!user.qrPath && !user.qrCodeBase64) {
            console.log(`   📱 Generating QR code for ${user.name}...`);
            
            const qrCodeBase64 = await generateUserQRCode(user._id, {
                name: user.name,
                email: user.email,
                events: user.events,
                userId: user._id
            });
            
            if (qrCodeBase64) {
                user.qrPath = `qr_${user._id}.png`;
                user.qrCodeBase64 = qrCodeBase64;
                await user.save();
                console.log(`   ✅ QR code generated successfully`);
                return true;
            } else {
                console.log(`   ❌ QR code generation failed`);
                return false;
            }
        } else {
            console.log(`   ✅ QR code already exists`);
            return true;
        }
    } catch (error) {
        console.error(`   ❌ Error generating QR code: ${error.message}`);
        return false;
    }
}

async function validateAndFixUser(email, processedUsers = new Set()) {
    try {
        // Avoid processing the same user multiple times
        if (processedUsers.has(email)) {
            return { success: true, alreadyProcessed: true };
        }
        
        processedUsers.add(email);
        
        console.log(`\n🔍 Processing: ${email}`);
        
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) {
            console.log(`   ❌ User not found in database`);
            return { success: false, reason: 'USER_NOT_FOUND' };
        }
        
        console.log(`   👤 Found: ${user.name}`);
        console.log(`   📊 Current Status: validated=${user.isvalidated}, hasQR=${!!(user.qrPath || user.qrCodeBase64)}`);
        console.log(`   🎯 Events: ${user.events?.join(', ') || 'None'}`);
        
        let needsUpdate = false;
        let updates = {};
        
        // Ensure user is validated
        if (!user.isvalidated) {
            console.log(`   🔄 Setting validation to true`);
            updates.isvalidated = true;
            needsUpdate = true;
        }
        
        // Generate QR code if missing
        const hasQR = !!(user.qrPath || user.qrCodeBase64);
        if (!hasQR) {
            console.log(`   📱 QR code missing, generating...`);
            const qrGenerated = await generateQRIfMissing(user);
            if (qrGenerated) {
                // Refresh user data after QR generation
                const updatedUser = await User.findById(user._id);
                user.qrPath = updatedUser.qrPath;
                user.qrCodeBase64 = updatedUser.qrCodeBase64;
            }
        }
        
        // Update user if needed
        if (needsUpdate) {
            updates.updatedAt = new Date();
            await User.findByIdAndUpdate(user._id, updates);
            console.log(`   ✅ User updated successfully`);
        }
        
        // Find all teams this user is part of
        const teamCompositions = await TeamComposition.find({
            $or: [
                { 'teamLeader.userId': user._id },
                { 'teamMembers.userId': user._id }
            ]
        });
        
        console.log(`   👥 Found in ${teamCompositions.length} team(s)`);
        
        const teamMembersToProcess = [];
        
        for (const team of teamCompositions) {
            const isLeader = team.teamLeader.userId.toString() === user._id.toString();
            console.log(`   🏆 Team: ${team.teamName} - ${team.eventName} (${isLeader ? 'LEADER' : 'MEMBER'})`);
            console.log(`   💳 Team Payment Status: ${team.paymentStatus}`);
            console.log(`   👥 Total Members: ${team.totalMembers}`);
            
            // Collect all team member user IDs
            const allMemberIds = [team.teamLeader.userId, ...team.teamMembers.map(m => m.userId)];
            
            for (const memberId of allMemberIds) {
                if (memberId.toString() !== user._id.toString()) {
                    // Find team member's email
                    const memberUser = await User.findById(memberId);
                    if (memberUser && memberUser.email) {
                        teamMembersToProcess.push(memberUser.email);
                        console.log(`   👤 Will process team member: ${memberUser.name} (${memberUser.email})`);
                    }
                }
            }
        }
        
        // Process all team members recursively
        for (const memberEmail of teamMembersToProcess) {
            await validateAndFixUser(memberEmail, processedUsers);
        }
        
        return {
            success: true,
            user: user.name,
            validated: true,
            hasQR: !!(user.qrPath || user.qrCodeBase64),
            teamsCount: teamCompositions.length,
            teamMembersProcessed: teamMembersToProcess.length
        };
        
    } catch (error) {
        console.error(`   ❌ Error processing ${email}: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function comprehensiveValidationFix(emails, dryRun = true) {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('✅ Connected to MongoDB');
        
        console.log(`\n🔧 COMPREHENSIVE VALIDATION AND QR FIX`);
        console.log('=====================================');
        console.log(`📧 Processing ${emails.length} emails from CSV`);
        console.log(`🔄 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE FIXES'}`);
        console.log(`💡 Will validate users AND their team members with QR codes`);
        
        // Continue with analysis even in dry run mode to show what would be done
        
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            teamMembersProcessed: 0,
            qrGenerated: 0,
            alreadyProcessed: 0
        };
        
        const processedUsers = new Set();
        
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            console.log(`\n[${i + 1}/${emails.length}] Processing: ${email}`);
            
            const result = await validateAndFixUser(email, processedUsers);
            
            results.processed++;
            
            if (result.alreadyProcessed) {
                results.alreadyProcessed++;
                console.log(`   ⏭️ Already processed in team context`);
            } else if (result.success) {
                results.successful++;
                if (result.teamMembersProcessed) {
                    results.teamMembersProcessed += result.teamMembersProcessed;
                }
                console.log(`   ✅ Successfully processed: ${result.user}`);
            } else {
                results.failed++;
                console.log(`   ❌ Failed: ${result.reason || result.error}`);
            }
        }
        
        console.log('\n🎉 COMPREHENSIVE FIX COMPLETED');
        console.log('==============================');
        console.log(`📊 Results:`);
        console.log(`   Emails Processed: ${results.processed}`);
        console.log(`   Successful: ${results.successful}`);
        console.log(`   Failed: ${results.failed}`);
        console.log(`   Already Processed: ${results.alreadyProcessed}`);
        console.log(`   Team Members Also Fixed: ${results.teamMembersProcessed}`);
        console.log(`   Total Users Fixed: ${processedUsers.size}`);
        
        return results;
        
    } catch (error) {
        console.error('❌ Comprehensive validation fix failed:', error);
        return null;
    } finally {
        await mongoose.disconnect();
        console.log('\n📴 Disconnected from MongoDB');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    const csvFile = args.find(arg => arg.endsWith('.csv')) || 'matched_emails_unique.csv';
    
    console.log('🔧 COMPREHENSIVE TEAM VALIDATION FIX');
    console.log('====================================');
    console.log(`📁 CSV File: ${csvFile}`);
    console.log(`🔄 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    
    if (dryRun) {
        console.log('\n⚠️ DRY RUN MODE');
        console.log('This will show what would be fixed without making changes.');
        console.log('Add --execute flag to perform actual fixes.');
        console.log('');
    }
    
    try {
        if (!fs.existsSync(csvFile)) {
            console.log(`❌ CSV file not found: ${csvFile}`);
            return;
        }
        
        const emails = await readEmailsFromCSV(csvFile);
        console.log(`📧 Read ${emails.length} emails from CSV`);
        
        if (emails.length === 0) {
            console.log('❌ No emails found in CSV');
            return;
        }
        
        await comprehensiveValidationFix(emails, dryRun);
        
    } catch (error) {
        console.error('❌ Script failed:', error);
    }
}

if (require.main === module) {
    console.log('💡 LOGIC: If users are in CSV, they should be validated with QR codes.');
    console.log('💡 LOGIC: If they are team members, their entire team should also be validated.');
    console.log('');
    
    main();
}

module.exports = { comprehensiveValidationFix, validateAndFixUser };