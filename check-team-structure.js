const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const mongoUri = process.env.mongodb || process.env.MONGO_URI || process.env.mongodburl;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
};

const teamCompositionSchema = new mongoose.Schema({
  eventName: String,
  teamName: String,
  teamLeader: Object,
  teamMembers: Array,
  createdAt: Date
}, { collection: 'teamcompositions' });

const TeamComposition = mongoose.model('TeamComposition', teamCompositionSchema);

const main = async () => {
  try {
    await connectDB();
    const team = await TeamComposition.findOne({
      eventName: 'DANCE BATTLE',
      teamName: 'IIT Delhi Dance Crew'
    }).sort({ createdAt: -1 });

    if (!team) {
      console.log('Team not found');
      return;
    }

    console.log('Current Team Structure:');
    console.log('Team ID:', team._id);
    console.log('Leader:', team.teamLeader.name, '-', team.teamLeader.email);
    console.log('Members:');
    team.teamMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.name} - ${member.email} - Role: ${member.role || 'not set'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

main();