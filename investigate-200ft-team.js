/**
 * Search for team "200ft" and check its event configuration
 * Investigate why it's not appearing under BAND JAM
 */

const mongoose = require('mongoose');
const { User, TeamComposition } = require('./models/models');

async function checkTeam200ft() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔍 SEARCHING FOR TEAM "200ft"');
    console.log('=' .repeat(60));
    
    // Search for team by name (case insensitive)
    console.log('\n📋 Searching for team compositions...');
    const teamCompositions = await TeamComposition.find({
      teamName: { $regex: /200ft/i }
    });
    
    console.log(`📊 Found ${teamCompositions.length} team compositions matching "200ft"`);
    
    if (teamCompositions.length === 0) {
      // Try broader search
      console.log('\n🔍 Trying broader search for "200"...');
      const broaderSearch = await TeamComposition.find({
        teamName: { $regex: /200/i }
      });
      
      console.log(`📊 Found ${broaderSearch.length} teams with "200" in name:`);
      broaderSearch.forEach((team, idx) => {
        console.log(`${idx + 1}. ${team.teamName} - Event: ${team.eventName}`);
      });
    } else {
      // Analyze found teams
      for (let i = 0; i < teamCompositions.length; i++) {
        const team = teamCompositions[i];
        console.log(`\n📋 TEAM ${i + 1}: ${team.teamName}`);
        console.log('=' .repeat(40));
        console.log(`🏷️  Team Name: "${team.teamName}"`);
        console.log(`🎯 Event: "${team.eventName}"`);
        console.log(`👥 Team Members: ${team.teamMembers ? team.teamMembers.length : 0}`);
        console.log(`📅 Created: ${team.createdAt}`);
        console.log(`🆔 Team ID: ${team._id}`);
        
        // Check if event matches BAND JAM
        const isBandJam = team.eventName && (
          team.eventName.toLowerCase().includes('band') ||
          team.eventName.toLowerCase().includes('jam') ||
          team.eventName.toLowerCase() === 'band jam'
        );
        
        console.log(`🎵 Is BAND JAM event: ${isBandJam ? '✅ Yes' : '❌ No'}`);
        
        // Show team members
        if (team.teamMembers && team.teamMembers.length > 0) {
          console.log('\n👥 Team Members:');
          console.log('-' .repeat(30));
          
          for (let j = 0; j < team.teamMembers.length; j++) {
            const member = team.teamMembers[j];
            console.log(`${j + 1}. ${member.name || 'Unknown'} (${member.email || 'No email'})`);
            console.log(`   Phone: ${member.contactNo || 'Not provided'}`);
            console.log(`   University: ${member.universityName || 'Not provided'}`);
          }
        }
      }
    }
    
    // Search for users who might be part of "200ft" team
    console.log('\n🔍 SEARCHING FOR USERS MENTIONING "200ft"...');
    console.log('-' .repeat(60));
    
    const usersWithTeamName = await User.find({
      $or: [
        { name: { $regex: /200ft/i } },
        { universityName: { $regex: /200ft/i } },
        { address: { $regex: /200ft/i } }
      ]
    }).select('name email contactNo universityName events');
    
    console.log(`📊 Found ${usersWithTeamName.length} users mentioning "200ft"`);
    
    usersWithTeamName.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.name} (${user.email})`);
      console.log(`   University: ${user.universityName}`);
      console.log(`   Events: ${user.events ? user.events.join(', ') : 'None'}`);
    });
    
    // Check all BAND JAM teams
    console.log('\n🎵 ALL BAND JAM TEAMS:');
    console.log('-' .repeat(60));
    
    const bandJamTeams = await TeamComposition.find({
      eventName: { $regex: /band.*jam|jam.*band/i }
    });
    
    console.log(`📊 Found ${bandJamTeams.length} BAND JAM teams:`);
    
    bandJamTeams.forEach((team, idx) => {
      console.log(`${idx + 1}. "${team.teamName}" - Event: "${team.eventName}" - Members: ${team.teamMembers ? team.teamMembers.length : 0}`);
    });
    
    // Check for any team with "200" in the name
    console.log('\n🔍 ALL TEAMS WITH "200" IN NAME:');
    console.log('-' .repeat(60));
    
    const teamsWith200 = await TeamComposition.find({
      teamName: { $regex: /200/i }
    });
    
    console.log(`📊 Found ${teamsWith200.length} teams with "200" in name:`);
    
    teamsWith200.forEach((team, idx) => {
      console.log(`${idx + 1}. "${team.teamName}" - Event: "${team.eventName}" - Members: ${team.teamMembers ? team.teamMembers.length : 0}`);
    });
    
    // Check all unique event names
    console.log('\n🎯 ALL UNIQUE EVENT NAMES:');
    console.log('-' .repeat(60));
    
    const allEvents = await TeamComposition.distinct('eventName');
    console.log(`📊 Total unique events: ${allEvents.length}`);
    
    allEvents.sort().forEach((event, idx) => {
      console.log(`${idx + 1}. "${event}"`);
    });
    
    console.log('\n🔍 INVESTIGATION COMPLETED');
    
  } catch (error) {
    console.error('❌ Error investigating team 200ft:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Run the investigation
checkTeam200ft();