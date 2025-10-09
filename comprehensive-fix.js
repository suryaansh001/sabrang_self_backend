/**
 * Comprehensive Fix Script:
 * 1. Check purchases schema for payment verification
 * 2. Generate QR codes for team members
 * 3. Create CSV of paid users
 * 4. Fix users with no events assigned
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const fs = require('fs');
const path = require('path');

async function comprehensiveFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔧 COMPREHENSIVE SYSTEM FIX');
    console.log('=' .repeat(80));
    
    // Step 1: Analyze Purchases Schema
    console.log('\n💰 STEP 1: ANALYZING PURCHASES SCHEMA');
    console.log('-' .repeat(60));
    
    const allPurchases = await Purchase.find({}).lean();
    console.log(`📊 Total purchases in database: ${allPurchases.length}`);
    
    // Group purchases by payment status
    const purchaseStats = {
      completed: allPurchases.filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'PAID').length,
      pending: allPurchases.filter(p => p.paymentStatus === 'pending').length,
      failed: allPurchases.filter(p => p.paymentStatus === 'failed' || p.paymentStatus === 'FAILED').length,
      other: allPurchases.filter(p => !['completed', 'PAID', 'pending', 'failed', 'FAILED'].includes(p.paymentStatus)).length
    };
    
    console.log(`✅ Completed payments: ${purchaseStats.completed}`);
    console.log(`⏳ Pending payments: ${purchaseStats.pending}`);
    console.log(`❌ Failed payments: ${purchaseStats.failed}`);
    console.log(`❓ Other status: ${purchaseStats.other}`);
    
    // Get all successful purchases with order IDs
    const successfulPurchases = allPurchases.filter(p => 
      p.paymentStatus === 'completed' || 
      p.paymentStatus === 'PAID' || 
      p.paymentStatus === 'success'
    );
    
    console.log(`💰 Verified paid orders: ${successfulPurchases.length}`);
    
    // Extract order IDs and user emails from successful purchases
    const paidOrderIds = new Set();
    const paidUserEmails = new Set();
    const orderToUserMap = new Map();
    
    for (const purchase of successfulPurchases) {
      if (purchase.orderId) {
        paidOrderIds.add(purchase.orderId);
      }
      if (purchase.userEmail) {
        paidUserEmails.add(purchase.userEmail.toLowerCase());
        if (purchase.orderId) {
          orderToUserMap.set(purchase.orderId, purchase.userEmail.toLowerCase());
        }
      }
    }
    
    console.log(`📧 Unique paid user emails: ${paidUserEmails.size}`);
    console.log(`🆔 Unique paid order IDs: ${paidOrderIds.size}`);
    
    // Step 2: Get all users and check payment status
    console.log('\n👥 STEP 2: CHECKING USER PAYMENT STATUS');
    console.log('-' .repeat(60));
    
    const allUsers = await User.find({}).lean();
    const allTeamCompositions = await TeamComposition.find({}).lean();
    
    console.log(`👤 Total direct users: ${allUsers.length}`);
    console.log(`👥 Total teams: ${allTeamCompositions.length}`);
    
    // Identify paid users
    const paidUsers = [];
    const unpaidUsers = [];
    
    for (const user of allUsers) {
      const userEmail = user.email.toLowerCase();
      const isPaid = paidUserEmails.has(userEmail);
      
      if (isPaid) {
        // Find the order ID for this user
        const userOrders = successfulPurchases.filter(p => 
          p.userEmail && p.userEmail.toLowerCase() === userEmail
        );
        
        paidUsers.push({
          ...user,
          userType: 'direct_user',
          orderIds: userOrders.map(o => o.orderId).filter(Boolean),
          purchaseDetails: userOrders
        });
      } else {
        unpaidUsers.push(user);
      }
    }
    
    console.log(`💰 Paid direct users: ${paidUsers.length}`);
    console.log(`❌ Unpaid direct users: ${unpaidUsers.length}`);
    
    // Step 3: Generate QR codes for team members
    console.log('\n📱 STEP 3: GENERATING QR CODES FOR TEAM MEMBERS');
    console.log('-' .repeat(60));
    
    let totalTeamMembers = 0;
    let qrGeneratedCount = 0;
    let qrFailedCount = 0;
    const paidTeamMembers = [];
    
    for (let i = 0; i < allTeamCompositions.length; i++) {
      const team = allTeamCompositions[i];
      console.log(`\n${i + 1}/${allTeamCompositions.length}. Processing team: ${team.teamName}`);
      
      const updatedTeamMembers = [];
      
      if (team.teamMembers && team.teamMembers.length > 0) {
        for (let j = 0; j < team.teamMembers.length; j++) {
          const member = team.teamMembers[j];
          totalTeamMembers++;
          
          console.log(`   Member ${j + 1}: ${member.name} (${member.email})`);
          
          // Check if member is paid
          const memberEmail = member.email ? member.email.toLowerCase() : '';
          const isPaid = paidUserEmails.has(memberEmail);
          
          // Generate QR code if missing
          let qrCode = member.qrCodeBase64;
          let needsQR = !qrCode;
          
          if (needsQR && member._id) {
            try {
              console.log(`   🔄 Generating QR code for ${member.name}...`);
              qrCode = await generateUserQRCode(member._id.toString(), member);
              qrGeneratedCount++;
              console.log(`   ✅ QR code generated successfully`);
            } catch (error) {
              console.log(`   ❌ QR generation failed: ${error.message}`);
              qrFailedCount++;
            }
          } else if (qrCode) {
            console.log(`   ✅ QR code already exists`);
          } else {
            console.log(`   ⚠️  No member ID available for QR generation`);
          }
          
          // Update member with QR code
          const updatedMember = {
            ...member,
            qrCodeBase64: qrCode
          };
          
          updatedTeamMembers.push(updatedMember);
          
          // Add to paid team members if payment confirmed
          if (isPaid) {
            const memberOrders = successfulPurchases.filter(p => 
              p.userEmail && p.userEmail.toLowerCase() === memberEmail
            );
            
            paidTeamMembers.push({
              ...updatedMember,
              userType: 'team_member',
              teamName: team.teamName,
              teamEvent: team.eventName,
              orderIds: memberOrders.map(o => o.orderId).filter(Boolean),
              purchaseDetails: memberOrders
            });
          }
        }
        
        // Update team composition with new QR codes
        try {
          await TeamComposition.findByIdAndUpdate(team._id, {
            teamMembers: updatedTeamMembers
          });
          console.log(`   ✅ Team ${team.teamName} updated successfully`);
        } catch (error) {
          console.log(`   ❌ Failed to update team ${team.teamName}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 QR Code Generation Summary:`);
    console.log(`   👥 Total team members: ${totalTeamMembers}`);
    console.log(`   ✅ QR codes generated: ${qrGeneratedCount}`);
    console.log(`   ❌ QR generation failed: ${qrFailedCount}`);
    console.log(`   💰 Paid team members: ${paidTeamMembers.length}`);
    
    // Step 4: Fix users with no events
    console.log('\n🎯 STEP 4: FIXING USERS WITH NO EVENTS');
    console.log('-' .repeat(60));
    
    const usersWithNoEvents = allUsers.filter(user => 
      !user.events || user.events.length === 0
    );
    
    console.log(`❓ Users with no events: ${usersWithNoEvents.length}`);
    
    for (const user of usersWithNoEvents) {
      console.log(`   ⚠️  ${user.name} (${user.email}) - No events assigned`);
      
      // Try to find events from team memberships
      const userTeams = allTeamCompositions.filter(team => 
        team.teamMembers && team.teamMembers.some(member => 
          member.email && member.email.toLowerCase() === user.email.toLowerCase()
        )
      );
      
      if (userTeams.length > 0) {
        const teamEvents = userTeams.map(team => team.eventName);
        console.log(`   🔄 Found team events: ${teamEvents.join(', ')}`);
        
        try {
          await User.findByIdAndUpdate(user._id, {
            events: teamEvents
          });
          console.log(`   ✅ Updated events for ${user.name}`);
        } catch (error) {
          console.log(`   ❌ Failed to update events: ${error.message}`);
        }
      } else {
        console.log(`   ❓ No team memberships found - manual review needed`);
      }
    }
    
    // Step 5: Create CSV of all paid users
    console.log('\n📄 STEP 5: CREATING CSV OF PAID USERS');
    console.log('-' .repeat(60));
    
    const allPaidUsers = [...paidUsers, ...paidTeamMembers];
    console.log(`💰 Total paid users: ${allPaidUsers.length}`);
    
    if (allPaidUsers.length > 0) {
      const csvHeaders = [
        'Name',
        'Email',
        'Contact Number',
        'University',
        'Events',
        'User Type',
        'Team Name',
        'Team Event',
        'Order IDs',
        'Payment Status',
        'Has QR Code',
        'Is Validated',
        'Registration Date'
      ];
      
      const csvRows = allPaidUsers.map(user => [
        (user.name || '').replace(/,/g, ';'),
        user.email || '',
        user.contactNo || '',
        (user.universityName || '').replace(/,/g, ';'),
        (user.events || []).join('; '),
        user.userType || 'direct_user',
        (user.teamName || '').replace(/,/g, ';'),
        (user.teamEvent || '').replace(/,/g, ';'),
        (user.orderIds || []).join('; '),
        'PAID',
        user.qrCodeBase64 ? 'Yes' : 'No',
        user.isvalidated ? 'Yes' : 'No',
        user.createdAt ? new Date(user.createdAt).toLocaleString() : ''
      ]);
      
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(field => {
            const fieldStr = String(field || '');
            if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
              return `"${fieldStr.replace(/"/g, '""')}"`;
            }
            return fieldStr;
          }).join(',')
        )
      ].join('\n');
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `paid_users_verified_${timestamp}.csv`;
      const filepath = path.join(__dirname, filename);
      
      fs.writeFileSync(filepath, csvContent, 'utf8');
      
      console.log(`✅ CSV file created: ${filename}`);
      console.log(`📁 File path: ${filepath}`);
      console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    }
    
    // Final Summary
    console.log('\n📊 COMPREHENSIVE FIX SUMMARY');
    console.log('=' .repeat(80));
    console.log(`💰 Total purchases analyzed: ${allPurchases.length}`);
    console.log(`✅ Successful payments: ${successfulPurchases.length}`);
    console.log(`📧 Paid user emails: ${paidUserEmails.size}`);
    console.log(`👤 Paid direct users: ${paidUsers.length}`);
    console.log(`👥 Paid team members: ${paidTeamMembers.length}`);
    console.log(`📱 QR codes generated: ${qrGeneratedCount}`);
    console.log(`❌ QR generation failures: ${qrFailedCount}`);
    console.log(`🎯 Users with no events fixed: ${usersWithNoEvents.length}`);
    console.log(`📄 Paid users CSV created with ${allPaidUsers.length} records`);
    
    console.log('\n🎉 COMPREHENSIVE FIX COMPLETED!');
    
    return {
      totalPurchases: allPurchases.length,
      successfulPayments: successfulPurchases.length,
      paidUsers: allPaidUsers.length,
      qrCodesGenerated: qrGeneratedCount,
      usersWithNoEvents: usersWithNoEvents.length
    };
    
  } catch (error) {
    console.error('❌ Error in comprehensive fix:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { comprehensiveFix };

// Run the script if called directly
if (require.main === module) {
  comprehensiveFix();
}