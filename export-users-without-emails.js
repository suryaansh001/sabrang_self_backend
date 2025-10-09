/**
 * Export users who haven't received emails to CSV
 * Checks both direct users and team members
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
const fs = require('fs');
const path = require('path');

async function exportUsersWithoutEmails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('📧 CHECKING EMAIL STATUS FOR ALL USERS');
    console.log('=' .repeat(80));
    
    // Get all direct users
    console.log('\n📊 Fetching all direct users...');
    const allUsers = await User.find({})
      .select('name email contactNo universityName events emailSent isvalidated createdAt hasEntered qrCodeBase64')
      .lean();
    
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Filter users who haven't received emails
    const usersWithoutEmails = allUsers.filter(user => !user.emailSent);
    
    console.log(`📧 Direct users without emails: ${usersWithoutEmails.length}`);
    
    // Get all team compositions and their members
    console.log('\n📊 Fetching team members...');
    const teamCompositions = await TeamComposition.find({})
      .select('teamName eventName teamMembers createdAt')
      .lean();
    
    console.log(`📊 Total teams: ${teamCompositions.length}`);
    
    // Extract team members who haven't received emails
    const teamMembersWithoutEmails = [];
    let totalTeamMembers = 0;
    
    for (const team of teamCompositions) {
      if (team.teamMembers && team.teamMembers.length > 0) {
        for (const member of team.teamMembers) {
          totalTeamMembers++;
          if (!member.emailSent) {
            teamMembersWithoutEmails.push({
              name: member.name || 'Unknown',
              email: member.email || 'No email',
              contactNo: member.contactNo || 'No contact',
              universityName: member.universityName || 'No university',
              events: [team.eventName],
              emailSent: false,
              isvalidated: member.isvalidated || false,
              createdAt: team.createdAt,
              hasEntered: member.hasEntered || false,
              qrCodeBase64: member.qrCodeBase64 || null,
              userType: 'team_member',
              teamName: team.teamName,
              teamEvent: team.eventName
            });
          }
        }
      }
    }
    
    console.log(`📊 Total team members: ${totalTeamMembers}`);
    console.log(`📧 Team members without emails: ${teamMembersWithoutEmails.length}`);
    
    // Combine all users without emails
    const allUsersWithoutEmails = [
      ...usersWithoutEmails.map(user => ({
        ...user,
        userType: 'direct_user',
        teamName: '',
        teamEvent: ''
      })),
      ...teamMembersWithoutEmails
    ];
    
    console.log('\n📊 EMAIL STATUS SUMMARY:');
    console.log('-' .repeat(60));
    console.log(`👥 Total participants: ${allUsers.length + totalTeamMembers}`);
    console.log(`📧 Direct users without emails: ${usersWithoutEmails.length}`);
    console.log(`📧 Team members without emails: ${teamMembersWithoutEmails.length}`);
    console.log(`📧 TOTAL without emails: ${allUsersWithoutEmails.length}`);
    
    // Calculate percentages
    const totalParticipants = allUsers.length + totalTeamMembers;
    const percentageWithoutEmails = ((allUsersWithoutEmails.length / totalParticipants) * 100).toFixed(2);
    
    console.log(`📊 Percentage without emails: ${percentageWithoutEmails}%`);
    
    // Analyze by event
    console.log('\n🎯 BREAKDOWN BY EVENT:');
    console.log('-' .repeat(60));
    
    const eventBreakdown = {};
    
    for (const user of allUsersWithoutEmails) {
      const events = user.events || [];
      if (events.length === 0) {
        events.push('No events');
      }
      
      for (const event of events) {
        if (!eventBreakdown[event]) {
          eventBreakdown[event] = 0;
        }
        eventBreakdown[event]++;
      }
    }
    
    const sortedEvents = Object.entries(eventBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([event, count]) => ({ event, count }));
    
    for (const { event, count } of sortedEvents) {
      console.log(`${event}: ${count} users`);
    }
    
    // Generate CSV content
    console.log('\n📄 GENERATING CSV FILE...');
    console.log('-' .repeat(60));
    
    const csvHeaders = [
      'Name',
      'Email',
      'Contact Number',
      'University',
      'Events',
      'User Type',
      'Team Name',
      'Team Event',
      'Has QR Code',
      'Is Validated',
      'Has Entered',
      'Registration Date'
    ];
    
    const csvRows = allUsersWithoutEmails.map(user => [
      (user.name || '').replace(/,/g, ';'),
      user.email || '',
      user.contactNo || '',
      (user.universityName || '').replace(/,/g, ';'),
      (user.events || []).join('; '),
      user.userType || 'direct_user',
      (user.teamName || '').replace(/,/g, ';'),
      (user.teamEvent || '').replace(/,/g, ';'),
      user.qrCodeBase64 ? 'Yes' : 'No',
      user.isvalidated ? 'Yes' : 'No',
      user.hasEntered ? 'Yes' : 'No',
      user.createdAt ? new Date(user.createdAt).toLocaleString() : ''
    ]);
    
    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => {
          // Escape fields that contain commas or quotes
          const fieldStr = String(field || '');
          if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }
          return fieldStr;
        }).join(',')
      )
    ].join('\n');
    
    // Write CSV file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `users_without_emails_${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    console.log(`✅ CSV file created: ${filename}`);
    console.log(`📁 File path: ${filepath}`);
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    // Show sample of users without emails
    console.log('\n👥 SAMPLE USERS WITHOUT EMAILS (First 10):');
    console.log('-' .repeat(60));
    
    const sampleUsers = allUsersWithoutEmails.slice(0, 10);
    for (let i = 0; i < sampleUsers.length; i++) {
      const user = sampleUsers[i];
      console.log(`${i + 1}. ${user.name} (${user.email})`);
      console.log(`   Type: ${user.userType}, Events: ${(user.events || []).join(', ')}`);
      console.log(`   QR Code: ${user.qrCodeBase64 ? 'Yes' : 'No'}, Validated: ${user.isvalidated ? 'Yes' : 'No'}`);
      if (user.teamName) {
        console.log(`   Team: ${user.teamName} (${user.teamEvent})`);
      }
      console.log('');
    }
    
    // Identify users with missing critical data
    console.log('\n⚠️  USERS WITH MISSING CRITICAL DATA:');
    console.log('-' .repeat(60));
    
    const usersWithMissingData = allUsersWithoutEmails.filter(user => 
      !user.email || 
      !user.name || 
      !user.qrCodeBase64 ||
      !user.events ||
      user.events.length === 0
    );
    
    console.log(`📊 Users with missing critical data: ${usersWithMissingData.length}`);
    
    const missingDataBreakdown = {
      noEmail: allUsersWithoutEmails.filter(u => !u.email || u.email === 'No email').length,
      noName: allUsersWithoutEmails.filter(u => !u.name || u.name === 'Unknown').length,
      noQR: allUsersWithoutEmails.filter(u => !u.qrCodeBase64).length,
      noEvents: allUsersWithoutEmails.filter(u => !u.events || u.events.length === 0).length
    };
    
    console.log(`❌ No email: ${missingDataBreakdown.noEmail}`);
    console.log(`❌ No name: ${missingDataBreakdown.noName}`);
    console.log(`❌ No QR code: ${missingDataBreakdown.noQR}`);
    console.log(`❌ No events: ${missingDataBreakdown.noEvents}`);
    
    console.log('\n🎉 EMAIL STATUS EXPORT COMPLETED!');
    console.log(`📄 CSV file saved as: ${filename}`);
    console.log(`📧 Total users without emails: ${allUsersWithoutEmails.length}`);
    
    return {
      totalParticipants,
      usersWithoutEmails: allUsersWithoutEmails.length,
      directUsers: usersWithoutEmails.length,
      teamMembers: teamMembersWithoutEmails.length,
      percentageWithoutEmails,
      filename,
      filepath
    };
    
  } catch (error) {
    console.error('❌ Error exporting users without emails:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { exportUsersWithoutEmails };

// Run the script if called directly
if (require.main === module) {
  exportUsersWithoutEmails();
}