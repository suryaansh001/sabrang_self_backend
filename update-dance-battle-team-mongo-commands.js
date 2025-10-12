// MongoDB commands to update IIT Delhi Dance Crew team
// Run these commands in MongoDB shell or use mongo command

// 1. First, get the team ID
db.teamcompositions.findOne({eventName: "DANCE BATTLE", teamName: "IIT Delhi Dance Crew"}, {sort: {createdAt: -1}})

// 2. Update team leader role and email
db.teamcompositions.updateOne(
  { _id: ObjectId("68e9c7133e872b2ff0e10657") },
  {
    $set: {
      "teamLeader.role": "leader",
      "teamLeader.email": "27sanskritibansal@gmail.com"
    }
  }
)

// 3. Update all team members with new roles and emails
db.teamcompositions.updateOne(
  { _id: ObjectId("68e9c7133e872b2ff0e10657") },
  {
    $set: {
      "teamMembers.0.role": "member",
      "teamMembers.0.email": "hbagotia2005@gmail.com",
      "teamMembers.1.role": "member",
      "teamMembers.1.email": "aakritiharit16@gmail.com",
      "teamMembers.2.role": "member",
      "teamMembers.2.email": "sarthak.maurya.iitd@gmail.com",
      "teamMembers.3.role": "member",
      "teamMembers.3.email": "omsrathi1234@gmail.com",
      "teamMembers.4.role": "member",
      "teamMembers.4.email": "krishnasharma.357.9@gmail.com",
      "teamMembers.5.role": "member",
      "teamMembers.5.email": "",
      "teamMembers.6.role": "member",
      "teamMembers.6.email": "srishtysingh277@gmail.com",
      "teamMembers.7.role": "member",
      "teamMembers.7.email": "vinayakgupta.iitd@gmail.com",
      "teamMembers.8.role": "member",
      "teamMembers.8.email": "asthaaa.shiness99@gmail.com",
      "teamMembers.9.role": "member",
      "teamMembers.9.email": "Pushkaladlakha3@gmail.com",
      "teamMembers.10.role": "member",
      "teamMembers.10.email": "bansaltanush806@gmail.com",
      "teamMembers.11.role": "member",
      "teamMembers.11.email": "aarushbansal2006@gmail.com",
      "teamMembers.12.role": "member",
      "teamMembers.12.email": "kataria.khushi12321@gmail.com",
      "teamMembers.13.role": "member",
      "teamMembers.13.email": "anjaligarg670@gmail.com",
      "teamMembers.14.role": "member",
      "teamMembers.14.email": "5678.koelkirtania@gmail.com",
      "teamMembers.15.role": "member",
      "teamMembers.15.email": "neelyadav06.ne@gmail.com",
      "teamMembers.16.role": "member",
      "teamMembers.16.email": "saksham1827@gmail.com",
      "teamMembers.17.role": "member",
      "teamMembers.17.email": "aashishsalokiya619@gmail.com",
      "teamMembers.18.role": "member",
      "teamMembers.18.email": "kanishksouda@gmail.com",
      "teamMembers.19.role": "member",
      "teamMembers.19.email": "nehal.ag.09@gmail.com",
      "teamMembers.20.role": "member",
      "teamMembers.20.email": "Gayatriwaykar18@gmail.com",
      "teamMembers.21.role": "member",
      "teamMembers.21.email": "veddantagrawal@gmail.com",
      "teamMembers.22.role": "member",
      "teamMembers.22.email": "abhishekny8@gmail.com"
    }
  }
)

// 4. Add Nagendra as a new team member
db.teamcompositions.updateOne(
  { _id: ObjectId("68e9c7133e872b2ff0e10657") },
  {
    $push: {
      teamMembers: {
        userId: null, // Will be set when user is created
        name: "Nagendra",
        email: "ms1221254@mse.iitd.ac.in",
        hasEntered: false,
        role: "member"
      }
    },
    $inc: {
      totalMembers: 1,
      "teamEntryStatus.pendingEntry": 1
    }
  }
)

// 5. Update total members count
db.teamcompositions.updateOne(
  { _id: ObjectId("68e9c7133e872b2ff0e10657") },
  {
    $set: {
      totalMembers: 25, // 24 members + 1 leader
      "teamEntryStatus.pendingEntry": 25
    }
  }
)

// 6. Also update the individual user records with personal emails
// Note: These commands update the users collection with personal emails
// You may want to store institutional emails separately if needed

// Update leader
db.users.updateOne(
  { email: "ee1230849@iitd.ac.in" },
  {
    $set: {
      personalEmail: "27sanskritibansal@gmail.com",
      contactNo: "7082576610"
    }
  }
)

// Update members with personal emails
db.users.updateOne({ email: "tt1231021@iitd.ac.in" }, { $set: { personalEmail: "hbagotia2005@gmail.com", contactNo: "8851430852" } });
db.users.updateOne({ email: "ch1230072@iitd.ac.in" }, { $set: { personalEmail: "aakritiharit16@gmail.com", contactNo: "6395697607" } });
db.users.updateOne({ email: "ch1230850@iitd.ac.in" }, { $set: { personalEmail: "sarthak.maurya.iitd@gmail.com", contactNo: "7303237442" } });
db.users.updateOne({ email: "tt1230913@iitd.ac.in" }, { $set: { personalEmail: "omsrathi1234@gmail.com", contactNo: "8421939539" } });
db.users.updateOne({ email: "ms1230865@iitd.ac.in" }, { $set: { personalEmail: "krishnasharma.357.9@gmail.com", contactNo: "9928176136" } });
db.users.updateOne({ email: "ee3230910@iitd.ac.in" }, { $set: { personalEmail: "", contactNo: "9216488054" } });
db.users.updateOne({ email: "ee1230786@iitd.ac.in" }, { $set: { personalEmail: "srishtysingh277@gmail.com", contactNo: "8574438211" } });
db.users.updateOne({ email: "mt1240012@iitd.ac.in" }, { $set: { personalEmail: "vinayakgupta.iitd@gmail.com", contactNo: "9289060966" } });
db.users.updateOne({ email: "hst254602@hss.iitd.ac.in" }, { $set: { personalEmail: "asthaaa.shiness99@gmail.com", contactNo: "6389135799" } });
db.users.updateOne({ email: "Tt1240845@iitd.ac.in" }, { $set: { personalEmail: "Pushkaladlakha3@gmail.com", contactNo: "8920858908" } });
db.users.updateOne({ email: "ee1241076@iitd.ac.in" }, { $set: { personalEmail: "bansaltanush806@gmail.com", contactNo: "8285262000" } });
db.users.updateOne({ email: "am1240207@iitd.ac.in" }, { $set: { personalEmail: "aarushbansal2006@gmail.com", contactNo: "9810230358" } });
db.users.updateOne({ email: "ch7240165@iitd.ac.in" }, { $set: { personalEmail: "kataria.khushi12321@gmail.com", contactNo: "9368177871" } });
db.users.updateOne({ email: "am1240414@iitd.ac.in" }, { $set: { personalEmail: "anjaligarg670@gmail.com", contactNo: "9560274425" } });
db.users.updateOne({ email: "ph1240008@physics.iitd.ac.in" }, { $set: { personalEmail: "5678.koelkirtania@gmail.com", contactNo: "9926424069" } });
db.users.updateOne({ email: "ee1240302@iitd.ac.in" }, { $set: { personalEmail: "neelyadav06.ne@gmail.com", contactNo: "7014219533" } });
db.users.updateOne({ email: "ee1240477@ee.iitd.ac.in" }, { $set: { personalEmail: "saksham1827@gmail.com", contactNo: "9634799339" } });
db.users.updateOne({ email: "bb1240957@gmail.com" }, { $set: { personalEmail: "aashishsalokiya619@gmail.com", contactNo: "9098100724" } });
db.users.updateOne({ email: "ch7240883@iitd.ac.in" }, { $set: { personalEmail: "kanishksouda@gmail.com", contactNo: "9509492737" } });
db.users.updateOne({ email: "ph1241024@iitd.ac.in" }, { $set: { personalEmail: "nehal.ag.09@gmail.com", contactNo: "9352040670" } });
db.users.updateOne({ email: "ce1240151@iitd.ac.in" }, { $set: { personalEmail: "Gayatriwaykar18@gmail.com", contactNo: "8767202517" } });
db.users.updateOne({ email: "ee3241115@iitd.ac.in" }, { $set: { personalEmail: "veddantagrawal@gmail.com", contactNo: "7007719032" } });
db.users.updateOne({ email: "tt1240654@iitd.ac.in" }, { $set: { personalEmail: "abhishekny8@gmail.com", contactNo: "7009422259" } });

// Create Nagendra user
db.users.insertOne({
  name: "Nagendra",
  email: "ms1221254@mse.iitd.ac.in",
  contactNo: "6392125073",
  events: ["DANCE BATTLE"],
  isvalidated: true,
  hasEntered: false,
  userType: "participant",
  teamRegistrations: [{
    eventName: "DANCE BATTLE",
    teamLeaderId: ObjectId("68e73c585effa62d95420a14"), // Sanskriti Bansal's ID
    isTeamLeader: false,
    teamName: "IIT Delhi Dance Crew",
    teamCompositionId: ObjectId("68e9c7133e872b2ff0e10657"),
    registeredAt: new Date()
  }],
  createdAt: new Date(),
  updatedAt: new Date()
});

// Update Nagendra's userId in team composition (replace null with actual user ID)
db.teamcompositions.updateOne(
  { _id: ObjectId("68e9c7133e872b2ff0e10657"), "teamMembers.name": "Nagendra" },
  {
    $set: {
      "teamMembers.$.userId": ObjectId("REPLACE_WITH_NAGENDRA_USER_ID")
    }
  }
);

// Verification commands
// Check updated team
db.teamcompositions.findOne({ _id: ObjectId("68e9c7133e872b2ff0e10657") }, { teamLeader: 1, teamMembers: 1 })

// Check if Nagendra was added
db.teamcompositions.findOne({ _id: ObjectId("68e9c7133e872b2ff0e10657") }, { teamMembers: { $elemMatch: { name: "Nagendra" } } })

// Count total members
db.teamcompositions.findOne({ _id: ObjectId("68e9c7133e872b2ff0e10657") }, { totalMembers: 1, teamMembers: 1 })