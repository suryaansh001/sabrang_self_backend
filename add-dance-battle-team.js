const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
require('dotenv').config();

// Dance Battle team data
const teamData = {
  eventName: 'DANCE BATTLE',
  teamName: 'IIT Delhi Dance Crew', // You can change this if needed
  leader: {
    name: 'Sanskriti Bansal',
    phone: '7082576610',
    personalEmail: '27sanskritibansal@gmail.com',
    instiEmail: 'ee1230849@iitd.ac.in'
  },
  members: [
    {
      name: 'Harsh Bagotia',
      phone: '8851430852',
      personalEmail: 'hbagotia2005@gmail.com',
      instiEmail: 'tt1231021@iitd.ac.in'
    },
    {
      name: 'Aakriti Harit',
      phone: '6395697607',
      personalEmail: 'aakritiharit16@gmail.com',
      instiEmail: 'ch1230072@iitd.ac.in'
    },
    {
      name: 'Sarthak Maurya',
      phone: '7303237442',
      personalEmail: 'sarthak.maurya.iitd@gmail.com',
      instiEmail: 'ch1230850@iitd.ac.in'
    },
    {
      name: 'Om rathi',
      phone: '8421939539',
      personalEmail: 'omsrathi1234@gmail.com',
      instiEmail: 'tt1230913@iitd.ac.in'
    },
    {
      name: 'Krishna',
      phone: '9928176136',
      personalEmail: 'krishnasharma.357.9@gmail.com',
      instiEmail: 'ms1230865@iitd.ac.in'
    },
    {
      name: 'Devansh Jain',
      phone: '9216488054',
      personalEmail: '', // No personal email provided
      instiEmail: 'ee3230910@iitd.ac.in'
    },
    {
      name: 'Srishty',
      phone: '8574438211',
      personalEmail: 'srishtysingh277@gmail.com',
      instiEmail: 'ee1230786@iitd.ac.in'
    },
    {
      name: 'Vinayak',
      phone: '9289060966',
      personalEmail: 'vinayakgupta.iitd@gmail.com',
      instiEmail: 'mt1240012@iitd.ac.in'
    },
    {
      name: 'Astha Agrawal',
      phone: '6389135799',
      personalEmail: 'asthaaa.shiness99@gmail.com',
      instiEmail: 'hst254602@hss.iitd.ac.in'
    },
    {
      name: 'Pushkal Adlakha',
      phone: '8920858908',
      personalEmail: 'Pushkaladlakha3@gmail.com',
      instiEmail: 'Tt1240845@iitd.ac.in'
    },
    {
      name: 'Tanush Bansal',
      phone: '8285262000',
      personalEmail: 'bansaltanush806@gmail.com',
      instiEmail: 'ee1241076@iitd.ac.in'
    },
    {
      name: 'Aarush Bansal',
      phone: '9810230358',
      personalEmail: 'aarushbansal2006@gmail.com',
      instiEmail: 'am1240207@iitd.ac.in'
    },
    {
      name: 'Khushi Kataria',
      phone: '9368177871',
      personalEmail: 'kataria.khushi12321@gmail.com',
      instiEmail: 'ch7240165@iitd.ac.in'
    },
    {
      name: 'Anjali Garg',
      phone: '9560274425',
      personalEmail: 'anjaligarg670@gmail.com',
      instiEmail: 'am1240414@iitd.ac.in'
    },
    {
      name: 'Koel Kirtania',
      phone: '9926424069',
      personalEmail: '5678.koelkirtania@gmail.com',
      instiEmail: 'ph1240008@physics.iitd.ac.in'
    },
    {
      name: 'Neel yadav',
      phone: '7014219533',
      personalEmail: 'neelyadav06.ne@gmail.com',
      instiEmail: 'ee1240302@iitd.ac.in'
    },
    {
      name: 'Saksham Singh',
      phone: '9634799339',
      personalEmail: 'saksham1827@gmail.com',
      instiEmail: 'ee1240477@ee.iitd.ac.in'
    },
    {
      name: 'Ashish Salokiya',
      phone: '9098100724',
      personalEmail: 'aashishsalokiya619@gmail.com',
      instiEmail: 'bb1240957@gmail.com'
    },
    {
      name: 'Kanishk Souda',
      phone: '9509492737',
      personalEmail: 'kanishksouda@gmail.com',
      instiEmail: 'ch7240883@iitd.ac.in'
    },
    {
      name: 'Nehal Agarwal',
      phone: '9352040670',
      personalEmail: 'nehal.ag.09@gmail.com',
      instiEmail: 'ph1241024@iitd.ac.in'
    },
    {
      name: 'Gayatri',
      phone: '8767202517',
      personalEmail: 'Gayatriwaykar18@gmail.com',
      instiEmail: 'ce1240151@iitd.ac.in'
    },
    {
      name: 'Veddant Agrawal',
      phone: '7007719032',
      personalEmail: 'veddantagrawal@gmail.com',
      instiEmail: 'ee3241115@iitd.ac.in'
    },
    {
      name: 'Abhishek Kumar',
      phone: '7009422259',
      personalEmail: 'abhishekny8@gmail.com',
      instiEmail: 'tt1240654@iitd.ac.in'
    }
  ],
  supportStaff: [
    {
      name: 'Amrit',
      phone: '6204025931',
      personalEmail: 'amritsr10978@gmail.com',
      instiEmail: 'tt1240909@iitd.ac.in'
    },
    {
      name: 'Aagam Jain',
      phone: '9752147671',
      personalEmail: 'aagam2006jqin@gmail.com',
      instiEmail: 'tt1240985@iitd.ac.in'
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

// Generate QR code for user
const generateQRForUser = async (user) => {
    try {
        // Import QR generation service
        const { generateUserQRCode } = require('./utils/qrCodeService');

        console.log(`   📱 Generating QR code for ${user.name}...`);

        // Prepare QR data
        const qrData = {
            name: user.name,
            email: user.email,
            events: user.events || [],
            userId: user._id
        };

        // Generate QR code using the service
        const qrCodeBase64 = await generateUserQRCode(user._id.toString(), qrData);

        if (qrCodeBase64) {
            user.qrCodeBase64 = qrCodeBase64;
            user.qrPath = `qr_${user._id}.png`;
            console.log(`   ✅ QR code generated for ${user.name}`);
            return true;
        } else {
            console.log(`   ❌ Failed to generate QR for ${user.name}: null response`);
            return false;
        }
    } catch (error) {
        console.error(`   ❌ Error generating QR for ${user.name}:`, error);
        return false;
    }
};

// Create or update user
const createOrUpdateUser = async (userData, isSupportStaff = false) => {
    try {
        console.log(`🔍 Processing user: ${userData.name} (${userData.instiEmail})`);

        // Check if user exists by institutional email
        let user = await User.findOne({ email: userData.instiEmail });

        if (user) {
            console.log(`   ✅ User exists: ${user.name} (${user._id})`);
            // Update user details if needed
            user.name = userData.name;
            user.contactNo = userData.phone;
            if (userData.personalEmail) {
                // Store personal email somewhere if needed, but use insti email as primary
            }
            user.userType = isSupportStaff ? 'support_staff' : 'participant';
        } else {
            console.log(`   🆕 Creating new user: ${userData.name}`);
            user = new User({
                name: userData.name,
                email: userData.instiEmail, // Use institutional email as primary
                contactNo: userData.phone,
                events: [teamData.eventName],
                isvalidated: true,
                hasEntered: false,
                userType: isSupportStaff ? 'support_staff' : 'participant',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Add event if not present
        if (!user.events.includes(teamData.eventName)) {
            user.events.push(teamData.eventName);
        }

        // Generate QR code if not present
        if (!user.qrCodeBase64) {
            await generateQRForUser(user);
        }

        await user.save();
        console.log(`   ✅ User processed: ${user._id}`);
        return user;

    } catch (error) {
        console.error(`   ❌ Error processing user ${userData.name}:`, error);
        throw error;
    }
};

// Create team composition
const createTeamComposition = async (leader, members) => {
    try {
        console.log(`\n🏆 Creating team composition for ${teamData.eventName}`);

        // Create team leader user
        const leaderUser = await createOrUpdateUser(leader);

        // Create team member users
        const memberUsers = [];
        for (const member of members) {
            const memberUser = await createOrUpdateUser(member);
            memberUsers.push(memberUser);
        }

        // Create team composition
        const teamComposition = new TeamComposition({
            eventName: teamData.eventName,
            teamName: teamData.teamName,
            teamLeader: {
                userId: leaderUser._id,
                name: leaderUser.name,
                email: leaderUser.email,
                hasEntered: false
            },
            teamMembers: memberUsers.map(user => ({
                userId: user._id,
                name: user.name,
                email: user.email,
                hasEntered: false,
                role: 'dancer'
            })),
            totalMembers: memberUsers.length + 1, // +1 for leader
            maxTeamSize: 25,
            registrationComplete: true,
            teamEntryStatus: {
                totalEntered: 0,
                pendingEntry: memberUsers.length + 1,
                allEntered: false
            },
            paymentStatus: 'completed',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await teamComposition.save();
        console.log(`   ✅ Team composition created: ${teamComposition._id}`);

        // Update user team registrations
        console.log(`   📝 Updating user team registrations...`);

        // Update leader
        leaderUser.teamRegistrations.push({
            eventName: teamData.eventName,
            teamLeaderId: leaderUser._id,
            isTeamLeader: true,
            teamName: teamData.teamName,
            teamCompositionId: teamComposition._id,
            registeredAt: new Date()
        });
        await leaderUser.save();

        // Update members
        for (const member of memberUsers) {
            member.teamRegistrations.push({
                eventName: teamData.eventName,
                teamLeaderId: leaderUser._id,
                isTeamLeader: false,
                teamName: teamData.teamName,
                teamCompositionId: teamComposition._id,
                registeredAt: new Date()
            });
            await member.save();
        }

        console.log(`   ✅ All user registrations updated`);

        return {
            teamComposition,
            leader: leaderUser,
            members: memberUsers
        };

    } catch (error) {
        console.error('❌ Error creating team composition:', error);
        throw error;
    }
};

// Process support staff
const processSupportStaff = async (supportStaff) => {
    try {
        console.log(`\n👥 Processing support staff...`);

        for (const staff of supportStaff) {
            await createOrUpdateUser(staff, true);
        }

        console.log(`   ✅ Support staff processed`);

    } catch (error) {
        console.error('❌ Error processing support staff:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();

        console.log('💃 DANCE BATTLE TEAM CREATION SCRIPT');
        console.log('=' .repeat(50));
        console.log(`Event: ${teamData.eventName}`);
        console.log(`Team: ${teamData.teamName}`);
        console.log(`Leader: ${teamData.leader.name}`);
        console.log(`Members: ${teamData.members.length}`);
        console.log(`Support Staff: ${teamData.supportStaff.length}`);
        console.log('=' .repeat(50));

        // Check if this is a dry run
        const args = process.argv.slice(2);
        const isDryRun = !args.includes('--execute');

        if (isDryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log('\n📋 Team Details:');
            console.log(`   Event: ${teamData.eventName}`);
            console.log(`   Team Name: ${teamData.teamName}`);
            console.log(`   Leader: ${teamData.leader.name} (${teamData.leader.instiEmail})`);
            console.log(`   Total Members: ${teamData.members.length + 1}`);
            console.log(`   Support Staff: ${teamData.supportStaff.length}`);

            console.log('\n👥 Team Members:');
            teamData.members.forEach((member, index) => {
                console.log(`   ${index + 1}. ${member.name} (${member.instiEmail})`);
            });

            console.log('\n🛠️  Support Staff:');
            teamData.supportStaff.forEach((staff, index) => {
                console.log(`   ${index + 1}. ${staff.name} (${staff.instiEmail})`);
            });

            console.log('\n🚀 Use --execute flag to create the team: node add-dance-battle-team.js --execute');
            return;
        }

        // Create team composition
        const result = await createTeamComposition(teamData.leader, teamData.members);

        // Process support staff
        await processSupportStaff(teamData.supportStaff);

        console.log('\n🎉 TEAM CREATION COMPLETED');
        console.log('=' .repeat(50));
        console.log('📊 Summary:');
        console.log(`   ✅ Event: ${teamData.eventName}`);
        console.log(`   ✅ Team: ${result.teamComposition.teamName}`);
        console.log(`   ✅ Team ID: ${result.teamComposition._id}`);
        console.log(`   ✅ Leader: ${result.leader.name} (${result.leader.email})`);
        console.log(`   ✅ Members: ${result.members.length}`);
        console.log(`   ✅ Total Participants: ${result.members.length + 1}`);
        console.log(`   ✅ Support Staff: ${teamData.supportStaff.length}`);
        console.log(`   ✅ QR Codes Generated: ${result.members.length + 1 + teamData.supportStaff.length}`);

        console.log('\n👥 Team Members:');
        result.members.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name} (${member.email}) - QR: ${member.qrCodeBase64 ? '✅' : '❌'}`);
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