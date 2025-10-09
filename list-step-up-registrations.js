/**
 * Comprehensive Script to List All STEP UP Registrations
 * Lists both individual users and team compositions for STEP UP event
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function listStepUpRegistrations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔍 STEP UP REGISTRATION ANALYSIS');
    console.log('=' .repeat(80));
    
    // 1. Find all users with STEP UP in their events
    console.log('\n📋 INDIVIDUAL USERS WITH STEP UP:');
    console.log('-' .repeat(50));
    
    const stepUpUsers = await User.find({ 
      events: 'STEP UP' 
    })
    .select('name email contactNo events userType profileImage qrPath isvalidated hasEntered createdAt')
    .sort({ createdAt: 1 });
    
    if (stepUpUsers.length > 0) {
      console.log(`Found ${stepUpUsers.length} users with STEP UP in their events:\n`);
      
      stepUpUsers.forEach((user, index) => {
        console.log(`${index + 1}. 👤 ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   📱 Contact: ${user.contactNo || 'Not provided'}`);
        console.log(`   🎯 Events: [${user.events.join(', ')}]`);
        console.log(`   👥 User Type: ${user.userType || 'participant'}`);
        console.log(`   ✅ Validated: ${user.isvalidated ? 'Yes' : 'No'}`);
        console.log(`   🚪 Has Entered: ${user.hasEntered ? 'Yes' : 'No'}`);
        console.log(`   🖼️ Profile Image: ${user.profileImage ? 'Yes' : 'No'}`);
        console.log(`   📱 QR Generated: ${user.qrPath ? 'Yes' : 'No'}`);
        console.log(`   📅 Registered: ${user.createdAt}`);
        console.log('');
      });
    } else {
      console.log('📭 No individual users found with STEP UP in their events');
    }
    
    // 2. Find all STEP UP team compositions
    console.log('\n🏆 TEAM COMPOSITIONS FOR STEP UP:');
    console.log('-' .repeat(50));
    
    const stepUpTeams = await TeamComposition.find({ 
      eventName: 'STEP UP' 
    })
    .populate('teamLeader.userId', 'name email contactNo profileImage qrPath isvalidated hasEntered')
    .populate('teamMembers.userId', 'name email contactNo profileImage qrPath isvalidated hasEntered userType')
    .sort({ createdAt: 1 });
    
    if (stepUpTeams.length > 0) {
      console.log(`Found ${stepUpTeams.length} STEP UP team registrations:\n`);
      
      stepUpTeams.forEach((team, index) => {
        console.log(`🏆 Team ${index + 1}: ${team.teamName}`);
        console.log(`   🆔 Team ID: ${team._id}`);
        console.log(`   📅 Created: ${team.createdAt}`);
        console.log(`   👑 Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        
        // Team leader details
        const leader = team.teamLeader.userId;
        if (leader) {
          console.log(`      📱 Contact: ${leader.contactNo || 'Not provided'}`);
          console.log(`      ✅ Validated: ${leader.isvalidated ? 'Yes' : 'No'}`);
          console.log(`      🚪 Has Entered: ${leader.hasEntered ? 'Yes' : 'No'}`);
          console.log(`      📱 QR Generated: ${leader.qrPath ? 'Yes' : 'No'}`);
        }
        
        console.log(`   👥 Team Size: ${team.totalMembers} members`);
        console.log(`   📊 Registration Complete: ${team.registrationComplete ? '✅' : '❌'}`);
        console.log(`   💳 Payment Status: ${team.paymentStatus || 'Not set'}`);
        
        // Team entry status
        if (team.teamEntryStatus) {
          console.log(`   🚪 Entry Status: ${team.teamEntryStatus.totalEntered}/${team.totalMembers} entered`);
          if (team.teamEntryStatus.firstEntryTime) {
            console.log(`      First Entry: ${team.teamEntryStatus.firstEntryTime}`);
          }
          if (team.teamEntryStatus.lastEntryTime) {
            console.log(`      Last Entry: ${team.teamEntryStatus.lastEntryTime}`);
          }
        }
        
        // Show team members
        if (team.teamMembers && team.teamMembers.length > 0) {
          console.log(`   👥 Team Members:`);
          team.teamMembers.forEach((member, memberIndex) => {
            const memberUser = member.userId;
            console.log(`      ${memberIndex + 1}. ${member.name} (${member.email})`);
            if (memberUser) {
              console.log(`         📱 Contact: ${memberUser.contactNo || 'Not provided'}`);
              console.log(`         👤 Type: ${memberUser.userType || 'participant'}`);
              console.log(`         ✅ Validated: ${memberUser.isvalidated ? 'Yes' : 'No'}`);
              console.log(`         🚪 Has Entered: ${memberUser.hasEntered ? 'Yes' : 'No'}`);
              console.log(`         📱 QR Generated: ${memberUser.qrPath ? 'Yes' : 'No'}`);
              if (member.role) {
                console.log(`         🎭 Role: ${member.role}`);
              }
            }
          });
        }
        
        console.log('   ' + '-'.repeat(60));
        console.log('');
      });
    } else {
      console.log('📭 No STEP UP team compositions found');
    }
    
    // 3. Find purchases related to STEP UP
    console.log('\n💰 PURCHASES RELATED TO STEP UP:');
    console.log('-' .repeat(50));
    
    const stepUpPurchases = await Purchase.find({
      $or: [
        { 'items.itemName': 'STEP UP' },
        { 'items.itemName': { $regex: 'STEP UP', $options: 'i' } }
      ]
    })
    .populate('userId', 'name email')
    .populate('mainPersonId', 'name email')
    .sort({ purchaseDate: -1 });
    
    if (stepUpPurchases.length > 0) {
      console.log(`Found ${stepUpPurchases.length} purchases related to STEP UP:\n`);
      
      stepUpPurchases.forEach((purchase, index) => {
        console.log(`💰 Purchase ${index + 1}:`);
        console.log(`   🆔 Order ID: ${purchase.orderId}`);
        console.log(`   📅 Purchase Date: ${purchase.purchaseDate}`);
        console.log(`   💳 Payment Status: ${purchase.paymentStatus}`);
        console.log(`   💵 Total Amount: ₹${purchase.totalAmount}`);
        
        // User details
        if (purchase.userId) {
          console.log(`   👤 User: ${purchase.userId.name} (${purchase.userId.email})`);
        } else if (purchase.mainPersonId) {
          console.log(`   👤 Main Person: ${purchase.mainPersonId.name} (${purchase.mainPersonId.email})`);
        } else if (purchase.userDetails) {
          console.log(`   👤 User Details: ${purchase.userDetails.name} (${purchase.userDetails.email})`);
        }
        
        // Items purchased
        console.log(`   🛒 Items:`);
        purchase.items.forEach((item, itemIndex) => {
          console.log(`      ${itemIndex + 1}. ${item.itemName} - ₹${item.price}`);
        });
        
        console.log(`   📝 User Registered: ${purchase.userRegistered ? 'Yes' : 'No'}`);
        console.log(`   📱 QR Generated: ${purchase.qrGenerated ? 'Yes' : 'No'}`);
        console.log(`   📧 Email Sent: ${purchase.emailSent ? 'Yes' : 'No'}`);
        
        console.log('');
      });
    } else {
      console.log('📭 No purchases found related to STEP UP');
    }
    
    // 4. Summary Statistics
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log('-' .repeat(50));
    
    const totalIndividualUsers = stepUpUsers.length;
    const totalTeams = stepUpTeams.length;
    const totalTeamMembers = stepUpTeams.reduce((sum, team) => sum + team.totalMembers, 0);
    const totalPurchases = stepUpPurchases.length;
    const completedPurchases = stepUpPurchases.filter(p => p.paymentStatus === 'completed').length;
    const totalRevenue = stepUpPurchases
      .filter(p => p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + p.totalAmount, 0);
    
    // Count validated users
    const validatedIndividuals = stepUpUsers.filter(u => u.isvalidated).length;
    const validatedTeamMembers = stepUpTeams.reduce((count, team) => {
      const leaderValidated = team.teamLeader.userId && team.teamLeader.userId.isvalidated ? 1 : 0;
      const membersValidated = team.teamMembers.filter(m => m.userId && m.userId.isvalidated).length;
      return count + leaderValidated + membersValidated;
    }, 0);
    
    // Count users who have entered
    const enteredIndividuals = stepUpUsers.filter(u => u.hasEntered).length;
    const enteredTeamMembers = stepUpTeams.reduce((count, team) => {
      const leaderEntered = team.teamLeader.userId && team.teamLeader.userId.hasEntered ? 1 : 0;
      const membersEntered = team.teamMembers.filter(m => m.userId && m.userId.hasEntered).length;
      return count + leaderEntered + membersEntered;
    }, 0);
    
    console.log(`👤 Individual Users with STEP UP: ${totalIndividualUsers}`);
    console.log(`🏆 STEP UP Teams: ${totalTeams}`);
    console.log(`👥 Total Team Members: ${totalTeamMembers}`);
    console.log(`📊 Total STEP UP Participants: ${totalIndividualUsers + totalTeamMembers}`);
    console.log(`💰 Total Purchases: ${totalPurchases}`);
    console.log(`✅ Completed Purchases: ${completedPurchases}`);
    console.log(`💵 Total Revenue: ₹${totalRevenue}`);
    console.log(`✅ Validated Users: ${validatedIndividuals + validatedTeamMembers}`);
    console.log(`🚪 Users Who Have Entered: ${enteredIndividuals + enteredTeamMembers}`);
    
    // Check for potential issues
    console.log('\n⚠️  POTENTIAL ISSUES:');
    console.log('-' .repeat(50));
    
    const usersWithoutQR = stepUpUsers.filter(u => !u.qrPath).length;
    const teamMembersWithoutQR = stepUpTeams.reduce((count, team) => {
      const leaderNoQR = team.teamLeader.userId && !team.teamLeader.userId.qrPath ? 1 : 0;
      const membersNoQR = team.teamMembers.filter(m => m.userId && !m.userId.qrPath).length;
      return count + leaderNoQR + membersNoQR;
    }, 0);
    
    const unvalidatedUsers = (totalIndividualUsers + totalTeamMembers) - (validatedIndividuals + validatedTeamMembers);
    const pendingPurchases = stepUpPurchases.filter(p => p.paymentStatus === 'pending').length;
    
    console.log(`📱 Users without QR codes: ${usersWithoutQR + teamMembersWithoutQR}`);
    console.log(`❌ Unvalidated users: ${unvalidatedUsers}`);
    console.log(`⏳ Pending purchases: ${pendingPurchases}`);
    
    return {
      individualUsers: stepUpUsers,
      teams: stepUpTeams,
      purchases: stepUpPurchases,
      stats: {
        totalIndividualUsers,
        totalTeams,
        totalTeamMembers,
        totalParticipants: totalIndividualUsers + totalTeamMembers,
        totalPurchases,
        completedPurchases,
        totalRevenue,
        validatedUsers: validatedIndividuals + validatedTeamMembers,
        enteredUsers: enteredIndividuals + enteredTeamMembers
      }
    };
    
  } catch (error) {
    console.error('❌ Error listing STEP UP registrations:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { listStepUpRegistrations };

// Run the script if called directly
if (require.main === module) {
  listStepUpRegistrations();
}