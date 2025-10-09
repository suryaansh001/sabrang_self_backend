/**
 * Update status for BAND JAM users with network issues
 * Mark them as "event not updated - network issue"
 */

const mongoose = require('mongoose');
const { User } = require('./models/models');

async function updateBandJamNetworkIssueUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🌐 UPDATING BAND JAM USERS WITH NETWORK ISSUES');
    console.log('=' .repeat(80));
    
    // List of BAND JAM users with network issues
    const networkIssueUsers = [
      'raghasharma2025@jklu.edu.in',
      'dishikasharma@jklu.edu.in', 
      'arnavsharma@jklu.edu.in',
      'pratigyabomb@jklu.edu.in',
      'pathakmayank522@gmail.com',
      'jainjheel1406@gmail.com',
      'asthabarnwal@jklu.edu.in'
    ];
    
    console.log(`📧 Processing ${networkIssueUsers.length} users with network issues...\n`);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    const updateResults = [];
    
    for (let i = 0; i < networkIssueUsers.length; i++) {
      const email = networkIssueUsers[i].toLowerCase();
      
      console.log(`${i + 1}/${networkIssueUsers.length}. Processing: ${email}`);
      console.log('-' .repeat(60));
      
      try {
        // Find the user
        const user = await User.findOne({ email: email });
        
        if (!user) {
          console.log(`   ❌ User not found: ${email}`);
          notFoundCount++;
          continue;
        }
        
        console.log(`   👤 Found user: ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🎯 Current events: ${user.events ? user.events.join(', ') : 'None'}`);
        console.log(`   📅 Registration date: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}`);
        console.log(`   ✅ Current validation status: ${user.isvalidated ? 'Validated' : 'Not validated'}`);
        
        // Update user with network issue status
        const updateData = {
          // Add a status field to indicate network issue
          networkIssueStatus: 'event not updated - network issue',
          networkIssueTimestamp: new Date(),
          // Keep existing events but add a note
          statusNotes: 'User registered for BAND JAM but had network issues during event update process',
          // Mark as having network issues
          hasNetworkIssues: true,
          // Update validation status to indicate review needed
          needsManualReview: true
        };
        
        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
          user._id, 
          updateData,
          { new: true }
        );
        
        console.log(`   ✅ Updated user status:`);
        console.log(`      🌐 Network Issue Status: ${updateData.networkIssueStatus}`);
        console.log(`      📝 Status Notes: ${updateData.statusNotes}`);
        console.log(`      🔍 Needs Manual Review: ${updateData.needsManualReview}`);
        console.log(`      ⏰ Issue Timestamp: ${updateData.networkIssueTimestamp.toLocaleString()}`);
        
        updateResults.push({
          name: user.name,
          email: user.email,
          events: user.events,
          status: 'Updated successfully',
          timestamp: updateData.networkIssueTimestamp
        });
        
        updatedCount++;
        
      } catch (error) {
        console.log(`   ❌ Error updating ${email}: ${error.message}`);
        updateResults.push({
          name: 'Unknown',
          email: email, 
          events: [],
          status: `Error: ${error.message}`,
          timestamp: new Date()
        });
      }
      
      console.log('');
    }
    
    // Summary
    console.log('📊 UPDATE SUMMARY:');
    console.log('-' .repeat(60));
    console.log(`👥 Total users processed: ${networkIssueUsers.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ Users not found: ${notFoundCount}`);
    console.log(`⚠️  Errors encountered: ${networkIssueUsers.length - updatedCount - notFoundCount}`);
    
    // Show updated users
    if (updatedCount > 0) {
      console.log('\n✅ SUCCESSFULLY UPDATED USERS:');
      console.log('-' .repeat(60));
      
      const successfulUpdates = updateResults.filter(result => result.status === 'Updated successfully');
      successfulUpdates.forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.name} (${result.email})`);
        console.log(`   🎯 Events: ${result.events ? result.events.join(', ') : 'None'}`);
        console.log(`   ⏰ Updated: ${result.timestamp.toLocaleString()}`);
        console.log('');
      });
    }
    
    // Verification - check users with network issues
    console.log('🔍 VERIFICATION - USERS WITH NETWORK ISSUES:');
    console.log('-' .repeat(60));
    
    const usersWithNetworkIssues = await User.find({
      hasNetworkIssues: true,
      networkIssueStatus: 'event not updated - network issue'
    }).select('name email events networkIssueStatus networkIssueTimestamp needsManualReview');
    
    console.log(`🌐 Total users with network issues: ${usersWithNetworkIssues.length}`);
    
    usersWithNetworkIssues.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} (${user.email})`);
      console.log(`   🎯 Events: ${user.events ? user.events.join(', ') : 'None'}`);
      console.log(`   🌐 Status: ${user.networkIssueStatus}`);
      console.log(`   🔍 Needs Review: ${user.needsManualReview ? 'Yes' : 'No'}`);
      console.log(`   ⏰ Issue Time: ${user.networkIssueTimestamp ? new Date(user.networkIssueTimestamp).toLocaleString() : 'Unknown'}`);
      console.log('');
    });
    
    // Create CSV report
    console.log('📄 CREATING NETWORK ISSUE REPORT CSV...');
    console.log('-' .repeat(60));
    
    const csvHeaders = [
      'Name',
      'Email', 
      'Events',
      'Network Issue Status',
      'Status Notes',
      'Needs Manual Review',
      'Issue Timestamp',
      'Update Status'
    ];
    
    const csvRows = updateResults.map(result => [
      result.name || '',
      result.email || '',
      result.events ? result.events.join('; ') : '',
      'event not updated - network issue',
      'User registered for BAND JAM but had network issues during event update process',
      'Yes',
      result.timestamp.toLocaleString(),
      result.status
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
    
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `bandjam_network_issues_${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    console.log(`✅ CSV report created: ${filename}`);
    console.log(`📁 File path: ${filepath}`);
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    console.log('\n🌐 NETWORK ISSUE STATUS UPDATE COMPLETED!');
    console.log('📝 These users are now marked for manual review due to network issues');
    console.log('🎯 They have BAND JAM event assigned but need payment verification');
    
    return {
      totalProcessed: networkIssueUsers.length,
      updated: updatedCount,
      notFound: notFoundCount,
      csvFile: filename,
      usersWithIssues: usersWithNetworkIssues.length
    };
    
  } catch (error) {
    console.error('❌ Error updating network issue users:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { updateBandJamNetworkIssueUsers };

// Run the script if called directly
if (require.main === module) {
  updateBandJamNetworkIssueUsers();
}