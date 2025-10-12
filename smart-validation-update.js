/**
 * Smart Validation Update Script
 * 
 * This script updates validation status while considering team-based payments.
 * It prevents invalidating team members whose teams have completed payments.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, Purchase, TeamComposition } = require('./models/models');

/**
 * Check if a user should be validated based on individual or team payments
 */
async function checkUserValidationStatus(user) {
    try {
        // Check individual payments first
        const completedPurchases = await Purchase.find({
            $or: [
                { userId: user._id },
                { mainPersonId: user._id },
                { 'userDetails.email': user.email }
            ],
            paymentStatus: 'completed'
        });
        
        if (completedPurchases.length > 0) {
            return {
                shouldBeValidated: true,
                reason: 'HAS_COMPLETED_INDIVIDUAL_PAYMENT',
                paymentType: 'individual',
                paymentCount: completedPurchases.length
            };
        }
        
        // Check team payments
        const teamCompositions = await TeamComposition.find({
            $or: [
                { 'teamLeader.userId': user._id },
                { 'teamMembers.userId': user._id }
            ],
            paymentStatus: 'completed'
        });
        
        if (teamCompositions.length > 0) {
            return {
                shouldBeValidated: true,
                reason: 'TEAM_MEMBER_WITH_COMPLETED_PAYMENT',
                paymentType: 'team',
                teamCount: teamCompositions.length,
                teams: teamCompositions.map(t => ({ 
                    eventName: t.eventName, 
                    teamName: t.teamName,
                    isLeader: t.teamLeader.userId.toString() === user._id.toString()
                }))
            };
        }
        
        // No completed payments found
        return {
            shouldBeValidated: false,
            reason: 'NO_COMPLETED_PAYMENTS',
            paymentType: 'none'
        };
        
    } catch (error) {
        console.error(`Error checking validation status for ${user.email}:`, error);
        return {
            shouldBeValidated: false,
            reason: 'ERROR_CHECKING',
            error: error.message
        };
    }
}

/**
 * Smart validation update that considers team payments
 */
async function smartValidationUpdate(emails, dryRun = true) {
    try {
        await mongoose.connect(process.env.mongodb);
        console.log('✅ Connected to MongoDB');
        
        console.log(`🔍 Smart validation check for ${emails.length} users...`);
        console.log(`🔄 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE UPDATES'}`);
        
        const results = {
            processed: 0,
            shouldInvalidate: 0,
            shouldValidate: 0,
            teamMembers: 0,
            individualUsers: 0,
            noAction: 0,
            errors: 0
        };
        
        const updates = [];
        
        for (const email of emails) {
            results.processed++;
            
            if (results.processed % 50 === 0) {
                console.log(`   Processing ${results.processed}/${emails.length}...`);
            }
            
            try {
                const user = await User.findOne({ email: email.toLowerCase().trim() });
                
                if (!user) {
                    console.log(`❌ User not found: ${email}`);
                    results.errors++;
                    continue;
                }
                
                const validationStatus = await checkUserValidationStatus(user);
                const currentlyValidated = user.isvalidated || false;
                
                let action = 'NO_ACTION';
                let shouldUpdate = false;
                
                if (validationStatus.shouldBeValidated && !currentlyValidated) {
                    action = 'VALIDATE';
                    shouldUpdate = true;
                    results.shouldValidate++;
                } else if (!validationStatus.shouldBeValidated && currentlyValidated) {
                    action = 'INVALIDATE';
                    shouldUpdate = true;
                    results.shouldInvalidate++;
                } else {
                    results.noAction++;
                }
                
                if (validationStatus.paymentType === 'team') {
                    results.teamMembers++;
                } else {
                    results.individualUsers++;
                }
                
                updates.push({
                    user,
                    email,
                    currentlyValidated,
                    shouldBeValidated: validationStatus.shouldBeValidated,
                    action,
                    shouldUpdate,
                    reason: validationStatus.reason,
                    paymentType: validationStatus.paymentType,
                    teams: validationStatus.teams || [],
                    paymentCount: validationStatus.paymentCount || 0
                });
                
            } catch (error) {
                console.error(`❌ Error processing ${email}:`, error.message);
                results.errors++;
            }
        }
        
        // Display results
        console.log('\n📊 SMART VALIDATION ANALYSIS RESULTS:');
        console.log('='.repeat(50));
        console.log(`📧 Total Processed: ${results.processed}`);
        console.log(`✅ Should Validate: ${results.shouldValidate}`);
        console.log(`❌ Should Invalidate: ${results.shouldInvalidate}`);
        console.log(`👥 Team Members: ${results.teamMembers}`);
        console.log(`👤 Individual Users: ${results.individualUsers}`);
        console.log(`⚪ No Action Needed: ${results.noAction}`);
        console.log(`⚠️ Errors: ${results.errors}`);
        
        // Show updates that would be made
        const updatesToMake = updates.filter(u => u.shouldUpdate);
        
        if (updatesToMake.length > 0) {
            console.log(`\n🔄 ${dryRun ? 'WOULD UPDATE' : 'UPDATING'} ${updatesToMake.length} users:`);
            console.log('-'.repeat(60));
            
            updatesToMake.forEach((update, index) => {
                console.log(`${index + 1}. ${update.user.name} (${update.email})`);
                console.log(`   Action: ${update.action} (${update.currentlyValidated} → ${update.shouldBeValidated})`);
                console.log(`   Reason: ${update.reason}`);
                console.log(`   Payment Type: ${update.paymentType}`);
                
                if (update.teams.length > 0) {
                    console.log(`   Teams:`);
                    update.teams.forEach(team => {
                        console.log(`     - ${team.eventName}: ${team.teamName} (${team.isLeader ? 'LEADER' : 'MEMBER'})`);
                    });
                }
                
                if (update.paymentCount > 0) {
                    console.log(`   Individual Payments: ${update.paymentCount}`);
                }
                
                console.log('');
            });
        }
        
        // Execute updates if not dry run
        if (!dryRun && updatesToMake.length > 0) {
            console.log('🔄 Executing updates...');
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const update of updatesToMake) {
                try {
                    const updateData = {
                        isvalidated: update.shouldBeValidated,
                        updatedAt: new Date()
                    };
                    
                    // If invalidating, also remove QR codes
                    if (!update.shouldBeValidated) {
                        updateData.qrPath = null;
                        updateData.qrCodeBase64 = null;
                        updateData.emailSent = false;
                        updateData.emailSentAt = null;
                    }
                    
                    await User.findByIdAndUpdate(update.user._id, updateData);
                    console.log(`✅ ${update.action}: ${update.user.name}`);
                    successCount++;
                    
                } catch (error) {
                    console.error(`❌ Error updating ${update.email}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log(`\n🎉 Updates completed: ${successCount} success, ${errorCount} errors`);
        } else if (dryRun) {
            console.log('\n🔒 DRY RUN MODE - No changes made');
            console.log('Add --execute flag to perform actual updates');
        }
        
        return { results, updates };
        
    } catch (error) {
        console.error('❌ Smart validation update failed:', error);
        return null;
    } finally {
        await mongoose.disconnect();
        console.log('\n📴 Disconnected from MongoDB');
    }
}

/**
 * Read emails from CSV file
 */
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

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    const csvFile = args.find(arg => arg.endsWith('.csv')) || 'matched_emails_unique.csv';
    
    console.log('🧠 SMART VALIDATION UPDATE TOOL');
    console.log('================================');
    console.log(`📁 CSV File: ${csvFile}`);
    console.log(`🔄 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log('💡 This tool considers both individual AND team payments');
    
    try {
        const emails = await readEmailsFromCSV(csvFile);
        console.log(`📧 Read ${emails.length} emails from CSV`);
        
        await smartValidationUpdate(emails, dryRun);
        
    } catch (error) {
        console.error('❌ Script failed:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { smartValidationUpdate, checkUserValidationStatus };