const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');
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
    },
    // New member: Nagendra
    {
      name: 'Nagendra',
      phone: '6392125073',
      personalEmail: '', // No personal email provided
      instiEmail: 'ms1221254@mse.iitd.ac.in',
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

// Update team composition with roles and emails
const updateTeamComposition = async (nagendraUser) => {
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

        // Update team members
        updatedTeamData.members.forEach((updatedMember, index) => {
            if (team.teamMembers[index] && updatedMember.name !== 'Nagendra') {
                team.teamMembers[index].role = updatedMember.role;
                team.teamMembers[index].email = updatedMember.personalEmail;
            }
        });

        // Add Nagendra if not already present
        const nagendraExists = team.teamMembers.some(member => member.name === 'Nagendra');
        if (!nagendraExists && nagendraUser) {
            console.log('➕ Adding Nagendra to the team...');
            team.teamMembers.push({
                userId: nagendraUser._id,
                name: 'Nagendra',
                email: 'ms1221254@mse.iitd.ac.in',
                hasEntered: false,
                role: 'member'
            });
        }

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

// Update user records with personal emails and phone numbers
const updateUserRecords = async () => {
    try {
        console.log('👥 Updating user records with personal emails and phone numbers...');

        // Update leader
        await User.findOneAndUpdate(
            { email: updatedTeamData.leader.instiEmail },
            {
                $set: {
                    personalEmail: updatedTeamData.leader.personalEmail,
                    contactNo: updatedTeamData.leader.phone
                }
            }
        );
        console.log(`✅ Updated leader: ${updatedTeamData.leader.name}`);

        // Update members
        for (const member of updatedTeamData.members) {
            if (member.name !== 'Nagendra') { // Skip Nagendra for now, will create separately
                await User.findOneAndUpdate(
                    { email: member.instiEmail },
                    {
                        $set: {
                            personalEmail: member.personalEmail || '',
                            contactNo: member.phone
                        }
                    }
                );
                console.log(`✅ Updated member: ${member.name}`);
            }
        }

        // Create Nagendra user
        console.log('🆕 Creating Nagendra user...');
        const nagendraUser = new User({
            name: 'Nagendra',
            email: 'ms1221254@mse.iitd.ac.in',
            contactNo: '6392125073',
            events: ['DANCE BATTLE'],
            isvalidated: true,
            hasEntered: false,
            userType: 'participant',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await nagendraUser.save();
        console.log(`✅ Created user: Nagendra (${nagendraUser._id})`);

        return nagendraUser;

    } catch (error) {
        console.error('❌ Error updating user records:', error);
        throw error;
    }
};

// Update team registrations for all users
const updateTeamRegistrations = async (team, nagendraUser) => {
    try {
        console.log('📝 Updating team registrations...');

        const leaderUser = await User.findOne({ email: updatedTeamData.leader.instiEmail });

        // Update leader's team registration
        if (leaderUser) {
            const existingReg = leaderUser.teamRegistrations.find(reg =>
                reg.eventName === 'DANCE BATTLE' && reg.teamName === 'IIT Delhi Dance Crew'
            );

            if (existingReg) {
                existingReg.registeredAt = new Date();
            } else {
                leaderUser.teamRegistrations.push({
                    eventName: 'DANCE BATTLE',
                    teamLeaderId: leaderUser._id,
                    isTeamLeader: true,
                    teamName: 'IIT Delhi Dance Crew',
                    teamCompositionId: team._id,
                    registeredAt: new Date()
                });
            }
            await leaderUser.save();
            console.log(`✅ Updated leader registration: ${leaderUser.name}`);
        }

        // Update members' team registrations
        for (const memberData of updatedTeamData.members) {
            if (memberData.name === 'Nagendra') {
                // Special handling for Nagendra
                nagendraUser.teamRegistrations.push({
                    eventName: 'DANCE BATTLE',
                    teamLeaderId: leaderUser._id,
                    isTeamLeader: false,
                    teamName: 'IIT Delhi Dance Crew',
                    teamCompositionId: team._id,
                    registeredAt: new Date()
                });
                await nagendraUser.save();
                console.log(`✅ Updated Nagendra registration`);
            } else {
                const memberUser = await User.findOne({ email: memberData.instiEmail });
                if (memberUser) {
                    const existingReg = memberUser.teamRegistrations.find(reg =>
                        reg.eventName === 'DANCE BATTLE' && reg.teamName === 'IIT Delhi Dance Crew'
                    );

                    if (existingReg) {
                        existingReg.registeredAt = new Date();
                    } else {
                        memberUser.teamRegistrations.push({
                            eventName: 'DANCE BATTLE',
                            teamLeaderId: leaderUser._id,
                            isTeamLeader: false,
                            teamName: 'IIT Delhi Dance Crew',
                            teamCompositionId: team._id,
                            registeredAt: new Date()
                        });
                    }
                    await memberUser.save();
                    console.log(`✅ Updated member registration: ${memberUser.name}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error updating team registrations:', error);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        await connectDB();

        console.log('💃 UPDATING IIT DELHI DANCE CREW TEAM');
        console.log('=' .repeat(60));
        console.log(`Event: DANCE BATTLE`);
        console.log(`Team: IIT Delhi Dance Crew`);
        console.log(`Changes:`);
        console.log(`  • Update roles: leader/member`);
        console.log(`  • Update emails to personal emails`);
        console.log(`  • Add Nagendra as new member`);
        console.log(`  • Update phone numbers`);
        console.log('=' .repeat(60));

        // Update user records first (including creating Nagendra)
        const nagendraUser = await updateUserRecords();

        // Update team composition
        const team = await updateTeamComposition(nagendraUser);

        // Update team registrations
        await updateTeamRegistrations(team, nagendraUser);

        console.log('\n🎉 TEAM UPDATE COMPLETED');
        console.log('=' .repeat(60));
        console.log('📊 Summary:');
        console.log(`   ✅ Team: ${team.teamName}`);
        console.log(`   ✅ Team ID: ${team._id}`);
        console.log(`   ✅ Leader: ${team.teamLeader.name} (Role: ${team.teamLeader.role})`);
        console.log(`   ✅ Members: ${team.teamMembers.length}`);
        console.log(`   ✅ Total Participants: ${team.totalMembers}`);
        console.log(`   ✅ Added: Nagendra`);
        console.log(`   ✅ Updated: Roles, emails, phone numbers`);

        console.log('\n👥 Updated Team Members:');
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