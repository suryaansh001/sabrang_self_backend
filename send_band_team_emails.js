const { MongoClient, ObjectId } = require('mongodb');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// MongoDB connection URL - adjust as needed
const MONGODB_URI = process.env.mongodb || 'mongodb+srv://ayushsharma2440:ayush@sabrang.icpskhz.mongodb.net/sabrang';

// Band member emails for reference
const bandMemberEmails = [
  "rohitansh.23fe10cii00083@muj.manipal.edu",
  "saarang.23fe10cse00093@muj.manipal.edu", 
  "ayush.229309230@muj.manipal.edu",
  "aryaveer6805@gmail.com",
  "vedantmusic485@gmail.com",
  "adityaranjanmuj@gmail.com",
  "suryanshpanda2005@gmail.com",
  "utkarsh.229301134@muj.manipal.edu"
];

async function sendEmailToMember(member, userData) {
  try {
    console.log(`\n📧 Sending registration email to ${member.name} (${member.email})...`);
    
    const emailData = {
      name: userData.name,
      events: ['Band Jam'], // Specific to band members
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

async function updateEmailStatus(db, userId, emailSuccess, emailError = null) {
  try {
    const updateData = {
      emailSent: emailSuccess,
      emailSentAt: emailSuccess ? new Date() : null,
      emailSentBy: emailSuccess ? 'admin_band_email_script' : null,
      updatedAt: new Date()
    };
    
    if (!emailSuccess && emailError) {
      updateData.emailError = emailError;
    }
    
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );
    
    console.log(`Updated email status for user ${userId}: ${emailSuccess ? 'sent' : 'failed'}`);
  } catch (error) {
    console.error('Error updating email status:', error);
  }
}

async function sendEmailsToBandTeam() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    console.log('\n🔍 Finding band team members...');
    
    // Find all band team members by their emails
    const bandMembers = await usersCollection.find({
      email: { $in: bandMemberEmails }
    }).toArray();
    
    if (bandMembers.length === 0) {
      console.log('❌ No band team members found in database!');
      return;
    }
    
    console.log(`✅ Found ${bandMembers.length} band team members`);
    bandMembers.forEach(member => {
      console.log(`  - ${member.name} (${member.email}) - Email sent: ${member.emailSent || false}`);
    });
    
    const emailResults = [];
    let emailsSent = 0;
    let emailsSkipped = 0;
    
    console.log('\n📧 Starting email sending process...');
    
    for (const member of bandMembers) {
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
      
      // Send email
      const emailResult = await sendEmailToMember(member, member);
      emailResults.push(emailResult);
      
      // Update email status in database
      await updateEmailStatus(db, member._id, emailResult.success, emailResult.error);
      
      if (emailResult.success) {
        emailsSent++;
      }
      
      // Add delay between emails to avoid rate limiting
      console.log('⏳ Waiting 3 seconds before next email...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Print comprehensive summary
    console.log('\n=== EMAIL SENDING SUMMARY ===');
    console.log(`👥 Total band members found: ${bandMembers.length}`);
    console.log(`📧 Emails sent: ${emailsSent}`);
    console.log(`⏭️  Emails skipped (already sent): ${emailsSkipped}`);
    
    const successfulEmails = emailResults.filter(r => r.success);
    const failedEmails = emailResults.filter(r => !r.success);
    
    console.log(`\n✅ SUCCESSFUL EMAILS (${successfulEmails.length}):`);
    if (successfulEmails.length > 0) {
      successfulEmails.forEach(result => console.log(`  ✓ ${result.member}`));
    }
    
    console.log(`\n❌ FAILED EMAILS (${failedEmails.length}):`);
    if (failedEmails.length > 0) {
      failedEmails.forEach(result => console.log(`  ✗ ${result.member}: ${result.error}`));
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
    
    console.log('\n📋 Band Team "200ft." Email Summary Complete!');
    
  } catch (error) {
    console.error('💥 Error sending emails to band team:', error);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
console.log('🚀 Starting Band Team Email Sender...');
console.log('🎵 Team: 200ft.');
console.log('📧 Event: Band Jam');
console.log('═'.repeat(50));

sendEmailsToBandTeam().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});