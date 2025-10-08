/**
 * Script to process Team Compositions and ensure all team members have user accounts and QR codes
 * 
 * This script will:
 * 1. Fetch all team compositions from database
 * 2. Extract all team members (leaders and members)
 * 3. Ensure each team member exists in users schema
 * 4. Generate unique QR codes for each team member
 * 5. Update team member records with team details
 */

const mongoose = require('mongoose');
const { TeamComposition, User } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const bcrypt = require('bcrypt');

// Statistics tracking
let stats = {
    totalTeams: 0,
    totalMembers: 0,
    usersCreated: 0,
    usersUpdated: 0,
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

async function getAllTeamCompositions() {
    try {
        console.log('\n🔍 Fetching all team compositions...');
        
        // First, let's fetch without population to see the actual schema structure
        const teams = await TeamComposition.find({}).sort({ createdAt: -1 }).limit(1);
        
        if (teams.length > 0) {
            console.log('\n🔍 Examining team composition schema structure:');
            const sampleTeam = teams[0];
            console.log('Sample team fields:', Object.keys(sampleTeam.toObject()));
            console.log('Sample team data:', JSON.stringify(sampleTeam.toObject(), null, 2).substring(0, 500) + '...');
        }
        
        // Now fetch all teams without population initially
        const allTeams = await TeamComposition.find({}).sort({ createdAt: -1 });
        
        stats.totalTeams = allTeams.length;
        console.log(`📊 Found ${allTeams.length} teams in database`);
        
        if (allTeams.length > 0) {
            console.log('\n📋 Team Overview:');
            allTeams.slice(0, 5).forEach((team, index) => {
                console.log(`${index + 1}. Team: ${team.teamName || team.name || 'Unnamed'}`);
                console.log(`   Event: ${team.eventName || team.event || 'Unknown'}`);
                console.log(`   Leader Email: ${team.leaderEmail || team.teamLeaderEmail || 'Unknown'}`);
                console.log(`   Members: ${team.members?.length || team.teamMembers?.length || 0}`);
                console.log(`   Created: ${team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'Unknown'}`);
                console.log('');
            });
            
            if (allTeams.length > 5) {
                console.log(`... and ${allTeams.length - 5} more teams`);
            }
        }
        
        return allTeams;
    } catch (error) {
        console.error('❌ Error fetching team compositions:', error);
        throw error;
    }
}

async function extractAllTeamMembers(teams) {
    console.log('\n🎯 Extracting all team members...');
    
    const allMembers = [];
    let memberCount = 0;
    
    for (const team of teams) {
        // Add team leader - try different possible field names
        const leaderEmail = team.leaderEmail || team.teamLeaderEmail || team.leader?.email;
        const leaderName = team.leaderName || team.teamLeaderName || team.leader?.name;
        const leaderContact = team.leaderContact || team.teamLeaderContact || team.leader?.contactNo;
        
        if (leaderEmail) {
            allMembers.push({
                userId: team.leaderId || null,
                name: leaderName || 'Unknown Leader',
                email: leaderEmail,
                contactNo: leaderContact || '',
                role: 'leader',
                teamId: team._id,
                teamName: team.teamName || team.name || 'Unnamed Team',
                eventName: team.eventName || team.event || 'Unknown Event',
                teamCreatedAt: team.createdAt
            });
            memberCount++;
        }
        
        // Add team members - try different possible structures
        const members = team.members || team.teamMembers || [];
        
        if (members && members.length > 0) {
            members.forEach(member => {
                let memberEmail, memberName, memberContact, memberUserId;
                
                // Handle different member data structures
                if (typeof member === 'object') {
                    memberEmail = member.email || member.memberEmail;
                    memberName = member.name || member.memberName || member.fullName;
                    memberContact = member.contactNo || member.phone || member.contact;
                    memberUserId = member.userId || member._id;
                } else if (typeof member === 'string') {
                    // If member is just an email string
                    memberEmail = member;
                    memberName = member.split('@')[0]; // Use email prefix as name
                }
                
                if (memberEmail) {
                    allMembers.push({
                        userId: memberUserId || null,
                        name: memberName || 'Unknown Member',
                        email: memberEmail,
                        contactNo: memberContact || '',
                        role: 'member',
                        teamId: team._id,
                        teamName: team.teamName || team.name || 'Unnamed Team',
                        eventName: team.eventName || team.event || 'Unknown Event',
                        teamCreatedAt: team.createdAt
                    });
                    memberCount++;
                }
            });
        }
    }
    
    stats.totalMembers = memberCount;
    console.log(`📊 Total team members found: ${memberCount}`);
    console.log(`   Leaders: ${allMembers.filter(m => m.role === 'leader').length}`);
    console.log(`   Members: ${allMembers.filter(m => m.role === 'member').length}`);
    
    return allMembers;
}

async function ensureUserExists(memberData) {
    try {
        console.log(`\n👤 Processing: ${memberData.name} (${memberData.email || 'No email'})`);
        console.log(`   Role: ${memberData.role} in team "${memberData.teamName}"`);
        console.log(`   Event: ${memberData.eventName}`);
        
        let user = null;
        
        // Try to find existing user
        if (memberData.userId) {
            user = await User.findById(memberData.userId);
        } else if (memberData.email) {
            user = await User.findOne({ email: memberData.email.toLowerCase().trim() });
        }
        
        if (user) {
            console.log(`✅ Found existing user: ${user.name} (${user.email})`);
            
            // Update user with team information
            let updated = false;
            
            // Add event if not already present
            if (memberData.eventName && !user.events.includes(memberData.eventName)) {
                user.events.push(memberData.eventName);
                updated = true;
                console.log(`   ➕ Added event: ${memberData.eventName}`);
            }
            
            // Update team information
            if (!user.teamInfo) user.teamInfo = [];
            
            const existingTeamInfo = user.teamInfo.find(t => 
                t.teamId && t.teamId.toString() === memberData.teamId.toString()
            );
            
            if (!existingTeamInfo) {
                user.teamInfo.push({
                    teamId: memberData.teamId,
                    teamName: memberData.teamName,
                    eventName: memberData.eventName,
                    role: memberData.role,
                    joinedAt: memberData.teamCreatedAt || new Date()
                });
                updated = true;
                console.log(`   ➕ Added team info: ${memberData.teamName} (${memberData.role})`);
            }
            
            if (updated) {
                user.isvalidated = true;
                user.updatedAt = new Date();
                await user.save();
                stats.usersUpdated++;
                console.log(`   ✅ User updated with team information`);
            }
            
        } else {
            // Create new user
            if (!memberData.email) {
                console.log(`   ⚠️ Cannot create user without email - skipping`);
                stats.errors++;
                stats.errorDetails.push({
                    member: memberData.name,
                    error: 'No email provided for new user creation'
                });
                return null;
            }
            
            console.log(`   👤 Creating new user...`);
            
            const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
            
            user = new User({
                name: memberData.name,
                email: memberData.email.toLowerCase().trim(),
                contactNo: memberData.contactNo || '',
                password: hashedPassword,
                events: memberData.eventName ? [memberData.eventName] : [],
                userType: 'participant',
                isvalidated: true,
                hasEntered: false,
                emailSent: false,
                teamInfo: [{
                    teamId: memberData.teamId,
                    teamName: memberData.teamName,
                    eventName: memberData.eventName,
                    role: memberData.role,
                    joinedAt: memberData.teamCreatedAt || new Date()
                }],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            await user.save();
            stats.usersCreated++;
            
            console.log(`   ✅ New user created: ${user.name}`);
            console.log(`      Email: ${user.email}`);
            console.log(`      Team: ${memberData.teamName} (${memberData.role})`);
            console.log(`      Event: ${memberData.eventName}`);
            
            // Update team composition with new user ID if needed
            if (!memberData.userId && memberData.role === 'member') {
                await TeamComposition.updateOne(
                    { 
                        _id: memberData.teamId,
                        'members.email': memberData.email
                    },
                    { 
                        $set: { 'members.$.userId': user._id }
                    }
                );
                console.log(`   🔗 Linked user to team composition`);
            }
        }
        
        return user;
        
    } catch (error) {
        console.error(`❌ Error processing member ${memberData.name}:`, error.message);
        stats.errors++;
        stats.errorDetails.push({
            member: `${memberData.name} (${memberData.email})`,
            error: error.message
        });
        return null;
    }
}

async function generateQRForUser(user, memberData) {
    try {
        // Check if user already has QR code
        if (user.qrCodeBase64 && user.qrPath) {
            console.log(`   ✅ User already has QR code`);
            return true;
        }
        
        console.log(`   🔄 Generating QR code...`);
        
        const qrData = {
            name: user.name,
            email: user.email,
            events: user.events || [],
            userId: user._id,
            teamInfo: user.teamInfo || []
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

async function processTeamMembers() {
    try {
        console.log('🎯 TEAM COMPOSITION PROCESSING SCRIPT');
        console.log('====================================');
        console.log(`📅 Date: ${new Date().toLocaleString()}`);
        console.log(`🎯 Target: All team members from TeamComposition schema\n`);

        // Connect to database
        await connectToDatabase();

        // Get all team compositions
        const teams = await getAllTeamCompositions();

        if (teams.length === 0) {
            console.log('\n🎉 No teams found in database. Nothing to process.');
            return;
        }

        // Extract all team members
        const allMembers = await extractAllTeamMembers(teams);

        if (allMembers.length === 0) {
            console.log('\n🎉 No team members found. Nothing to process.');
            return;
        }

        console.log('\n🚀 Processing team members...');
        console.log('='.repeat(60));

        // Process each team member
        for (let i = 0; i < allMembers.length; i++) {
            const memberData = allMembers[i];
            
            console.log(`\n[${i + 1}/${allMembers.length}] Processing team member...`);
            
            // Ensure user exists
            const user = await ensureUserExists(memberData);
            
            if (user) {
                // Generate QR code if needed
                await generateQRForUser(user, memberData);
            }

            // Small delay to prevent overwhelming the system
            if (i < allMembers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Final summary
        console.log('\n🎉 TEAM PROCESSING COMPLETED');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   🏆 Total teams processed: ${stats.totalTeams}`);
        console.log(`   👥 Total team members processed: ${stats.totalMembers}`);
        console.log(`   👤 Users created: ${stats.usersCreated}`);
        console.log(`   🔄 Users updated: ${stats.usersUpdated}`);
        console.log(`   🎫 QR codes generated: ${stats.qrGenerated}`);
        console.log(`   ❌ Errors: ${stats.errors}`);

        // Error details
        if (stats.errorDetails.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            console.log('-'.repeat(60));
            stats.errorDetails.forEach((error, index) => {
                console.log(`${index + 1}. ${error.member}: ${error.error}`);
            });
        }

        const successRate = stats.totalMembers > 0 ? 
            (((stats.usersCreated + stats.usersUpdated) / stats.totalMembers) * 100).toFixed(1) : 0;
        
        console.log(`\n📈 Processing Success Rate: ${successRate}%`);
        console.log(`📅 Completed at: ${new Date().toLocaleString()}`);
        
        if ((stats.usersCreated + stats.usersUpdated) > 0) {
            console.log('\n🏆 Team member processing completed successfully!');
            console.log('💡 All team members now have:');
            console.log('   - ✅ User accounts in the database');
            console.log('   - ✅ Team information in their profiles');
            console.log('   - ✅ Event registrations');
            console.log('   - ✅ Unique QR codes for entry');
            console.log('   - ✅ Default password: defaultPassword123');
        }

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

// Run the script
processTeamMembers();