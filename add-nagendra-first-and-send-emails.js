const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

// Updated team data with personal emails and roles
const updatedTeamData = {
  leader: {
    name: 'Sanskriti Bansal',
    phone: '7082576610',
    personalEmail: '27sanskritibansal@gmail.com',
    instiEmail: 'ee1230849@iitd.ac.in',
    role: 'leader'
  },
  members: [
    // Nagendra first in the team
    {
      name: 'Nagendra',
      phone: '6392125073',
      personalEmail: '', // No personal email provided
      instiEmail: 'ms1221254@mse.iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Harsh Bagotia',
      phone: '8851430852',
      personalEmail: 'hbagotia2005@gmail.com',
      instiEmail: 'tt1231021@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Aakriti Harit',
      phone: '6395697607',
      personalEmail: 'aakritiharit16@gmail.com',
      instiEmail: 'ch1230072@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Sarthak Maurya',
      phone: '7303237442',
      personalEmail: 'sarthak.maurya.iitd@gmail.com',
      instiEmail: 'ch1230850@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Om rathi',
      phone: '8421939539',
      personalEmail: 'omsrathi1234@gmail.com',
      instiEmail: 'tt1230913@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Krishna',
      phone: '9928176136',
      personalEmail: 'krishnasharma.357.9@gmail.com',
      instiEmail: 'ms1230865@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Devansh Jain',
      phone: '9216488054',
      personalEmail: '', // No personal email provided
      instiEmail: 'ee3230910@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Srishty',
      phone: '8574438211',
      personalEmail: 'srishtysingh277@gmail.com',
      instiEmail: 'ee1230786@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Vinayak',
      phone: '9289060966',
      personalEmail: 'vinayakgupta.iitd@gmail.com',
      instiEmail: 'mt1240012@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Amrit',
      phone: '6204025931',
      personalEmail: 'amritsr10978@gmail.com',
      instiEmail: 'tt1240909@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Astha Agrawal',
      phone: '6389135799',
      personalEmail: 'asthaaa.shiness99@gmail.com',
      instiEmail: 'hst254602@hss.iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Pushkal Adlakha',
      phone: '8920858908',
      personalEmail: 'Pushkaladlakha3@gmail.com',
      instiEmail: 'Tt1240845@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Tanush Bansal',
      phone: '8285262000',
      personalEmail: 'bansaltanush806@gmail.com',
      instiEmail: 'ee1241076@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Aarush Bansal',
      phone: '9810230358',
      personalEmail: 'aarushbansal2006@gmail.com',
      instiEmail: 'am1240207@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Khushi Kataria',
      phone: '9368177871',
      personalEmail: 'kataria.khushi12321@gmail.com',
      instiEmail: 'ch7240165@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Aagam Jain',
      phone: '9752147671',
      personalEmail: 'aagam2006jqin@gmail.com',
      instiEmail: 'tt1240985@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Anjali Garg',
      phone: '9560274425',
      personalEmail: 'anjaligarg670@gmail.com',
      instiEmail: 'am1240414@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Koel Kirtania',
      phone: '9926424069',
      personalEmail: '5678.koelkirtania@gmail.com',
      instiEmail: 'ph1240008@physics.iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Neel yadav',
      phone: '7014219533',
      personalEmail: 'neelyadav06.ne@gmail.com',
      instiEmail: 'ee1240302@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Saksham Singh',
      phone: '9634799339',
      personalEmail: 'saksham1827@gmail.com',
      instiEmail: 'ee1240477@ee.iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Ashish Salokiya',
      phone: '9098100724',
      personalEmail: 'aashishsalokiya619@gmail.com',
      instiEmail: 'bb1240957@gmail.com',
      role: 'member'
    },
    {
      name: 'Kanishk Souda',
      phone: '9509492737',
      personalEmail: 'kanishksouda@gmail.com',
      instiEmail: 'ch7240883@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Nehal Agarwal',
      phone: '9352040670',
      personalEmail: 'nehal.ag.09@gmail.com',
      instiEmail: 'ph1241024@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Gayatri',
      phone: '8767202517',
      personalEmail: 'Gayatriwaykar18@gmail.com',
      instiEmail: 'ce1240151@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Veddant Agrawal',
      phone: '7007719032',
      personalEmail: 'veddantagrawal@gmail.com',
      instiEmail: 'ee3241115@iitd.ac.in',
      role: 'member'
    },
    {
      name: 'Abhishek Kumar',
      phone: '7009422259',
      personalEmail: 'abhishekny8@gmail.com',
      instiEmail: 'tt1240654@iitd.ac.in',
      role: 'member'
    }
  ]
};

// MongoDB connection
const connectDB = async () => {
    try {
        const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl;
        await mongoose.connect(mongoUri);
        console.log('📊 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Generate QR codes for all team members
const generateQRCodesForTeam = async () => {
    try {
        console.log('📱 Generating QR codes for all team members...');

        let qrGenerated = 0;
        let qrSkipped = 0;

        // Generate QR for leader
        const leaderUser = await User.findOne({ email: updatedTeamData.leader.instiEmail });
        if (leaderUser) {
            if (!leaderUser.qrCodeBase64) {
                console.log(`   📱 Generating QR code for leader: ${leaderUser.name}...`);
                const qrCodeBase64 = await generateUserQRCode(leaderUser._id, {
                    name: leaderUser.name,
                    email: leaderUser.email,
                    events: leaderUser.events
                });
                if (qrCodeBase64) {
                    leaderUser.qrCodeBase64 = qrCodeBase64;
                    await leaderUser.save();
                    console.log(`   ✅ QR code generated for ${leaderUser.name}`);
                    qrGenerated++;
                }
            } else {
                console.log(`   ⏭️ QR code already exists for leader: ${leaderUser.name}`);
                qrSkipped++;
            }
        }

        // Generate QR for all members
        for (const memberData of updatedTeamData.members) {
            const memberUser = await User.findOne({ email: memberData.instiEmail });
            if (memberUser) {
                if (!memberUser.qrCodeBase64) {
                    console.log(`   📱 Generating QR code for ${memberUser.name}...`);
                    const qrCodeBase64 = await generateUserQRCode(memberUser._id, {
                        name: memberUser.name,
                        email: memberUser.email,
                        events: memberUser.events
                    });
                    if (qrCodeBase64) {
                        memberUser.qrCodeBase64 = qrCodeBase64;
                        await memberUser.save();
                        console.log(`   ✅ QR code generated for ${memberUser.name}`);
                        qrGenerated++;
                    }
                } else {
                    console.log(`   ⏭️ QR code already exists for ${memberUser.name}`);
                    qrSkipped++;
                }
            }
        }

        console.log(`\n📊 QR Code Generation Summary:`);
        console.log(`   ✅ Generated: ${qrGenerated}`);
        console.log(`   ⏭️ Skipped (already exist): ${qrSkipped}`);
        console.log(`   📱 Total QR codes ready: ${qrGenerated + qrSkipped}`);

        return { qrGenerated, qrSkipped };

    } catch (error) {
        console.error('❌ Error generating QR codes:', error);
        throw error;
    }
};

// Send emails to all team members with QR codes
const sendEmailsToTeam = async () => {
    try {
        console.log('📧 Sending emails to all team members with QR codes...');

        let emailsSent = 0;
        let emailsFailed = 0;

        // Send email to leader
        const leaderUser = await User.findOne({ email: updatedTeamData.leader.instiEmail });
        if (leaderUser && leaderUser.qrCodeBase64) {
            console.log(`   📧 Sending email to leader: ${leaderUser.name}...`);
            const emailData = {
                name: leaderUser.name,
                events: leaderUser.events,
                qrCodeBase64: leaderUser.qrCodeBase64
            };
            const emailResult = await sendRegistrationEmail(leaderUser.email, emailData);
            if (emailResult.success) {
                console.log(`   ✅ Email sent to ${leaderUser.name}`);
                emailsSent++;
            } else {
                console.log(`   ❌ Email failed for ${leaderUser.name}: ${emailResult.error}`);
                emailsFailed++;
            }
        }

        // Send emails to all members
        for (const memberData of updatedTeamData.members) {
            const memberUser = await User.findOne({ email: memberData.instiEmail });
            if (memberUser && memberUser.qrCodeBase64) {
                console.log(`   📧 Sending email to ${memberUser.name}...`);
                const emailData = {
                    name: memberUser.name,
                    events: memberUser.events,
                    qrCodeBase64: memberUser.qrCodeBase64
                };
                const emailResult = await sendRegistrationEmail(memberUser.email, emailData);
                if (emailResult.success) {
                    console.log(`   ✅ Email sent to ${memberUser.name}`);
                    emailsSent++;
                } else {
                    console.log(`   ❌ Email failed for ${memberUser.name}: ${emailResult.error}`);
                    emailsFailed++;
                }
            } else if (memberUser && !memberUser.qrCodeBase64) {
                console.log(`   ⚠️ Skipping ${memberUser.name} - no QR code available`);
            }
        }

        console.log(`\n📧 Email Sending Summary:`);
        console.log(`   ✅ Emails sent: ${emailsSent}`);
        console.log(`   ❌ Emails failed: ${emailsFailed}`);
        console.log(`   📧 Total emails attempted: ${emailsSent + emailsFailed}`);

        return { emailsSent, emailsFailed };

    } catch (error) {
        console.error('❌ Error sending emails:', error);
        throw error;
    }
};

// Update team composition with Nagendra first
const updateTeamComposition = async () => {
    try {
        console.log('🏆 Updating IIT Delhi Dance Crew team composition...');

        // Find the most recent team
        const team = await TeamComposition.findOne({
            eventName: 'DANCE BATTLE',
            teamName: 'IIT Delhi Dance Crew'
        }).sort({ createdAt: -1 });

        if (!team) {
            console.log('❌ Team not found!');
            return;
        }

        console.log(`📋 Found team: ${team._id}`);

        // Update team leader
        team.teamLeader.role = updatedTeamData.leader.role;
        team.teamLeader.email = updatedTeamData.leader.personalEmail;

        // Rebuild team members array with Nagendra first
        const nagendraUser = await User.findOne({ email: 'ms1221254@mse.iitd.ac.in' });
        if (!nagendraUser) {
            throw new Error('Nagendra user not found!');
        }

        // Start with Nagendra
        const updatedMembers = [{
            userId: nagendraUser._id,
            name: 'Nagendra',
            email: 'ms1221254@mse.iitd.ac.in',
            hasEntered: false,
            role: 'member'
        }];

        // Add other members
        for (const memberData of updatedTeamData.members.slice(1)) { // Skip Nagendra from the data array
            const memberUser = await User.findOne({ email: memberData.instiEmail });
            if (memberUser) {
                updatedMembers.push({
                    userId: memberUser._id,
                    name: memberData.name,
                    email: memberData.personalEmail || memberData.instiEmail,
                    hasEntered: false,
                    role: memberData.role
                });
            }
        }

        team.teamMembers = updatedMembers;

        // Update total members count
        team.totalMembers = team.teamMembers.length + 1; // +1 for leader
        team.teamEntryStatus.pendingEntry = team.totalMembers;

        await team.save();
        console.log('✅ Team composition updated successfully');

        return team;

    } catch (error) {
        console.error('❌ Error updating team composition:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();

        console.log('💃 UPDATING IIT DELHI DANCE CREW TEAM WITH NAGENDRA FIRST');
        console.log('=' .repeat(70));
        console.log(`Event: DANCE BATTLE`);
        console.log(`Team: IIT Delhi Dance Crew`);
        console.log(`Changes:`);
        console.log(`  • Add Nagendra as first team member`);
        console.log(`  • Generate QR codes for all members`);
        console.log(`  • Send emails with QR codes to all members`);
        console.log('=' .repeat(70));

        // Step 1: Generate QR codes for all team members
        console.log('\n🔄 STEP 1: Generating QR codes...');
        const qrResult = await generateQRCodesForTeam();

        // Step 2: Update team composition with Nagendra first
        console.log('\n🔄 STEP 2: Updating team composition...');
        const team = await updateTeamComposition();

        // Step 3: Send emails to all team members
        console.log('\n🔄 STEP 3: Sending emails with QR codes...');
        const emailResult = await sendEmailsToTeam();

        console.log('\n🎉 TEAM UPDATE COMPLETED');
        console.log('=' .repeat(70));
        console.log('📊 Summary:');
        console.log(`   ✅ Team: ${team.teamName}`);
        console.log(`   ✅ Team ID: ${team._id}`);
        console.log(`   ✅ Leader: ${team.teamLeader.name} (Role: ${team.teamLeader.role})`);
        console.log(`   ✅ Members: ${team.teamMembers.length}`);
        console.log(`   ✅ Total Participants: ${team.totalMembers}`);
        console.log(`   ✅ Nagendra: First in team members list`);
        console.log(`   📱 QR Codes Generated: ${qrResult.qrGenerated}`);
        console.log(`   📧 Emails Sent: ${emailResult.emailsSent}`);

        console.log('\n👥 Updated Team Members (Nagendra first):');
        team.teamMembers.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name} - ${member.email} (Role: ${member.role})`);
        });

    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        console.log('\n📴 Disconnecting from MongoDB');
        await mongoose.disconnect();
        process.exit(0);
    }
};

// Run the script
main().catch(console.error);