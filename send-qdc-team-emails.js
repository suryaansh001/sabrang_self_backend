const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Database connection
mongoose.connect('mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  collegeName: String,
  hasEntered: { type: Boolean, default: false },
  qrCode: String,
  qrCodeBase64: String,
  events: [String],
  emailSent: { type: Boolean, default: false },
  emailSentAt: Date,
  emailSentBy: String,
  emailError: String
}, { collection: 'users' });

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
    hasEntered: { type: Boolean, default: false }
  }]
}, { collection: 'teamcompositions' });

const User = mongoose.model('User', userSchema);
const TeamComposition = mongoose.model('TeamComposition', teamCompositionSchema);

async function sendEmailToMember(memberData, userData) {
  try {
    console.log(`\n📧 Sending registration email to ${memberData.name} (${memberData.email})...`);
    
    const emailData = {
      name: userData.name,
      events: userData.events || ['DANCE BATTLE'], // Use user's events or default to DANCE BATTLE
      qrCodeBase64: userData.qrCodeBase64
    };
    
    const emailResult = await sendRegistrationEmail(memberData.email, emailData);
    
    if (emailResult.success) {
      console.log(`✅ Email sent successfully to ${memberData.name}`);
      return { success: true, member: memberData.name, email: memberData.email };
    } else {
      console.error(`❌ Failed to send email to ${memberData.name}: ${emailResult.error}`);
      return { success: false, member: memberData.name, email: memberData.email, error: emailResult.error };
    }
  } catch (error) {
    console.error(`❌ Error sending email to ${memberData.name}:`, error.message);
    return { success: false, member: memberData.name, email: memberData.email, error: error.message };
  }
}

async function updateEmailStatus(userId, emailSuccess, emailError = null) {
  try {
    const updateData = {
      emailSent: emailSuccess,
      emailSentAt: emailSuccess ? new Date() : null,
      emailSentBy: emailSuccess ? 'admin_dance_team_email_script' : null,
      updatedAt: new Date()
    };
    
    if (!emailSuccess && emailError) {
      updateData.emailError = emailError;
    }
    
    await User.updateOne(
      { _id: userId },
      { $set: updateData }
    );
    
    console.log(`Updated email status for user ${userId}: ${emailSuccess ? 'sent' : 'failed'}`);
  } catch (error) {
    console.error('Error updating email status:', error);
  }
}

async function sendEmailsToQDCTeam() {
  try {
    console.log('🔍 Finding Quintessence Dance crew (QDC) team...');
    
    // Find the specific team by ObjectId
    const team = await TeamComposition.findOne({
      _id: new mongoose.Types.ObjectId('68e1277607a7eecad868484e')
    }).populate('teamLeader.userId').populate('teamMembers.userId');

    if (!team) {
      console.log('❌ QDC team not found!');
      return;
    }

    console.log('\n=== TEAM DETAILS ===');
    console.log(`Team: ${team.teamName}`);
    console.log(`Event: ${team.eventName}`);
    console.log(`Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
    console.log(`Team Members: ${team.teamMembers.length}`);

    // Get all team member user IDs to fetch their data
    const allMemberIds = [team.teamLeader.userId];
    team.teamMembers.forEach(member => {
      if (member.userId) {
        allMemberIds.push(member.userId);
      }
    });

    console.log(`\n🔍 Fetching user data for ${allMemberIds.length} team members...`);

    // Fetch all user data including QR codes
    const allMembers = await User.find({
      _id: { $in: allMemberIds }
    });

    if (allMembers.length === 0) {
      console.log('❌ No team member user data found!');
      return;
    }

    console.log(`✅ Found ${allMembers.length} team members in database`);
    
    // Display all members with their email status
    console.log('\n=== TEAM MEMBERS STATUS ===');
    allMembers.forEach((member, index) => {
      const isLeader = member._id.toString() === team.teamLeader.userId.toString();
      console.log(`${index + 1}. ${member.name} (${member.email})`);
      console.log(`   ${isLeader ? '👑 TEAM LEADER' : '👤 TEAM MEMBER'}`);
      console.log(`   📧 Email sent: ${member.emailSent || false}`);
      console.log(`   📱 QR Code: ${member.qrCodeBase64 ? 'Available' : 'Missing'}`);
      console.log(`   🎭 Events: [${member.events ? member.events.join(', ') : 'None'}]`);
    });

    const emailResults = [];
    let emailsSent = 0;
    let emailsSkipped = 0;

    console.log('\n📧 Starting email sending process...');
    console.log('═'.repeat(50));

    for (const member of allMembers) {
      // Check if email already sent
      if (member.emailSent) {
        console.log(`⏭️  Skipping ${member.name} - email already sent`);
        emailsSkipped++;
        continue;
      }

      // Check if QR code exists
      if (!member.qrCodeBase64) {
        console.log(`⚠️  Warning: ${member.name} has no QR code, sending email without QR`);
      }

      // Create member data for email function
      const memberData = {
        name: member.name,
        email: member.email
      };

      // Send email
      const emailResult = await sendEmailToMember(memberData, member);
      emailResults.push(emailResult);

      // Update email status in database
      await updateEmailStatus(member._id, emailResult.success, emailResult.error);

      if (emailResult.success) {
        emailsSent++;
      }

      // Add delay between emails to avoid rate limiting
      console.log('⏳ Waiting 3 seconds before next email...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Print comprehensive summary
    console.log('\n=== EMAIL SENDING SUMMARY ===');
    console.log(`🎭 Team: ${team.teamName}`);
    console.log(`🏆 Event: ${team.eventName}`);
    console.log(`👥 Total team members found: ${allMembers.length}`);
    console.log(`📧 Emails sent: ${emailsSent}`);
    console.log(`⏭️  Emails skipped (already sent): ${emailsSkipped}`);

    const successfulEmails = emailResults.filter(r => r.success);
    const failedEmails = emailResults.filter(r => !r.success);

    console.log(`\n✅ SUCCESSFUL EMAILS (${successfulEmails.length}):`);
    if (successfulEmails.length > 0) {
      successfulEmails.forEach(result => console.log(`  ✓ ${result.member} (${result.email})`));
    }

    console.log(`\n❌ FAILED EMAILS (${failedEmails.length}):`);
    if (failedEmails.length > 0) {
      failedEmails.forEach(result => console.log(`  ✗ ${result.member} (${result.email}): ${result.error}`));
    }

    if (emailResults.length === 0) {
      console.log('\n📢 All emails were already sent previously!');
    } else if (failedEmails.length === 0) {
      console.log('\n🎉 All emails sent successfully!');
    } else if (successfulEmails.length > 0) {
      console.log('\n⚠️  Some emails sent successfully, some failed. Check errors above.');
    } else {
      console.log('\n❌ All email attempts failed. Check your email configuration.');
    }

    console.log('\n📋 QDC Team Email Campaign Complete!');

  } catch (error) {
    console.error('💥 Error sending emails to QDC team:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
console.log('🚀 Starting QDC Team Email Sender...');
console.log('💃 Team: Quintessence Dance crew (QDC)');
console.log('🎭 Event: DANCE BATTLE');
console.log('👑 New Leader: Aryan Jain');
console.log('═'.repeat(50));

sendEmailsToQDCTeam().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});