const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Database connection
mongoose.connect(process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  collegeName: String,
  hasEntered: { type: Boolean, default: false },
  qrCodeBase64: String,
  events: [String],
  emailSent: { type: Boolean, default: false },
  emailSentAt: Date,
  emailSentBy: String
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

async function sendEmailToMember(member, userData) {
  try {
    console.log(`\n📧 Sending registration email to ${member.name} (${member.email})...`);

    const emailData = {
      name: userData.name,
      events: userData.events,
      qrCodeBase64: userData.qrCodeBase64
    };

    const emailResult = await sendRegistrationEmail(member.email, emailData);

    if (emailResult.success) {
      console.log(`✅ Email sent successfully to ${member.name}`);
      return { success: true, member: member.name };
    } else {
      console.error(`❌ Failed to send email to ${member.name}: ${emailResult.error}`);
      return { success: false, member: member.name, error: emailResult.error };
    }
  } catch (error) {
    console.error(`❌ Error sending email to ${member.name}:`, error.message);
    return { success: false, member: member.name, error: error.message };
  }
}

async function updateEmailStatus(userId, emailSuccess, emailError = null) {
  try {
    const updateData = {
      emailSent: emailSuccess,
      emailSentAt: emailSuccess ? new Date() : null,
      emailSentBy: emailSuccess ? 'iit_delhi_dance_crew_email_script' : null,
      updatedAt: new Date()
    };

    if (!emailSuccess && emailError) {
      updateData.emailError = emailError;
    }

    await User.updateOne({ _id: userId }, { $set: updateData });
    console.log(`📝 Updated email status for user ${userId}: ${emailSuccess ? 'sent' : 'failed'}`);
  } catch (error) {
    console.error(`Error updating email status for user ${userId}:`, error);
  }
}

async function sendIITDelhiDanceCrewEmails() {
  try {
    console.log('💃 Starting email sending for IIT Delhi Dance Crew - DANCE BATTLE');
    console.log('=' .repeat(70));

    // Get the most recent IIT Delhi Dance Crew team
    const team = await TeamComposition.findOne({
      eventName: 'DANCE BATTLE',
      teamName: 'IIT Delhi Dance Crew'
    }).sort({ createdAt: -1 });

    if (!team) {
      console.log('❌ IIT Delhi Dance Crew team not found!');
      return;
    }

    console.log(`\n📋 Team Details:`);
    console.log(`Event: ${team.eventName}`);
    console.log(`Team Name: ${team.teamName}`);
    console.log(`Team ID: ${team._id}`);
    console.log(`Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
    console.log(`Team Members: ${team.teamMembers.length}`);
    console.log(`Total People to Email: ${team.teamMembers.length + 1}`); // +1 for team leader

    const emailResults = {
      successful: [],
      failed: [],
      total: 0
    };

    // Email team leader first
    console.log('\n🎯 Sending email to TEAM LEADER:');
    console.log('=' .repeat(50));

    const leaderUser = await User.findOne({ _id: team.teamLeader.userId });
    if (leaderUser) {
      const leaderResult = await sendEmailToMember(team.teamLeader, leaderUser);
      await updateEmailStatus(leaderUser._id, leaderResult.success, leaderResult.error);

      if (leaderResult.success) {
        emailResults.successful.push(leaderResult.member);
      } else {
        emailResults.failed.push({ member: leaderResult.member, error: leaderResult.error });
      }
      emailResults.total++;
    } else {
      console.log(`❌ Team leader user record not found for ${team.teamLeader.name}`);
      emailResults.failed.push({ member: team.teamLeader.name, error: 'User record not found' });
      emailResults.total++;
    }

    // Email all team members
    console.log('\n👥 Sending emails to TEAM MEMBERS:');
    console.log('=' .repeat(50));

    for (let i = 0; i < team.teamMembers.length; i++) {
      const member = team.teamMembers[i];
      console.log(`\n[${i + 1}/${team.teamMembers.length}] Processing: ${member.name}`);
      console.log(`   Email: ${member.email}`);

      const memberUser = await User.findOne({ _id: member.userId });
      if (memberUser) {
        console.log(`   ✅ User record found - QR Code: ${memberUser.qrCodeBase64 ? 'Present' : 'Missing'}`);
        const memberResult = await sendEmailToMember(member, memberUser);
        await updateEmailStatus(memberUser._id, memberResult.success, memberResult.error);

        if (memberResult.success) {
          emailResults.successful.push(memberResult.member);
        } else {
          emailResults.failed.push({ member: memberResult.member, error: memberResult.error });
        }
      } else {
        console.log(`❌ User record not found for ${member.name}`);
        emailResults.failed.push({ member: member.name, error: 'User record not found' });
      }

      emailResults.total++;

      // Add small delay between emails to avoid overwhelming the email service
      if (i < team.teamMembers.length - 1) {
        console.log('⏳ Waiting 2 seconds before next email...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('\n' + '=' .repeat(70));
    console.log('📊 EMAIL SENDING SUMMARY');
    console.log('=' .repeat(70));
    console.log(`💃 Team: ${team.teamName}`);
    console.log(`📈 Total Emails Attempted: ${emailResults.total}`);
    console.log(`✅ Successful: ${emailResults.successful.length}`);
    console.log(`❌ Failed: ${emailResults.failed.length}`);

    if (emailResults.successful.length > 0) {
      console.log('\n✅ Successfully sent emails to:');
      emailResults.successful.forEach(name => console.log(`   • ${name}`));
    }

    if (emailResults.failed.length > 0) {
      console.log('\n❌ Failed to send emails to:');
      emailResults.failed.forEach(result => {
        console.log(`   • ${result.member}: ${result.error}`);
      });
    }

    console.log('\n🎉 Email sending process completed for IIT Delhi Dance Crew!');

  } catch (error) {
    console.error('❌ Error in email sending process:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the email sending
sendIITDelhiDanceCrewEmails();