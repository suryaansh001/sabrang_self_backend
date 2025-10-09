/**
 * Comprehensive BAND JAM Team Verification Script
 * 1. Verify all BAND JAM teams are properly categorized
 * 2. Check event name inconsistencies
 * 3. Analyze admin panel filtering logic
 * 4. Provide recommendations for fixes
 */

const mongoose = require('mongoose');
const { User, TeamComposition, Event } = require('./models/models');
const fs = require('fs');

async function verifyBandJamTeams() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('🎵 COMPREHENSIVE BAND JAM VERIFICATION');
    console.log('=' .repeat(80));
    
    // 1. Find all possible BAND JAM related event names
    console.log('\n📊 STEP 1: ANALYZING EVENT NAME VARIATIONS');
    console.log('-' .repeat(60));
    
    const allEventNames = await TeamComposition.distinct('eventName');
    const bandJamVariants = allEventNames.filter(name => 
      name && (
        name.toLowerCase().includes('band') ||
        name.toLowerCase().includes('jam')
      )
    );
    
    console.log(`🎯 Total unique event names: ${allEventNames.length}`);
    console.log(`🎵 BAND JAM related variants found: ${bandJamVariants.length}`);
    
    bandJamVariants.forEach((variant, idx) => {
      console.log(`   ${idx + 1}. "${variant}"`);
    });
    
    // 2. Get all teams for each variant
    console.log('\n📊 STEP 2: TEAMS BY EVENT NAME VARIANT');
    console.log('-' .repeat(60));
    
    let allBandJamTeams = [];
    let teamStats = {};
    
    for (const variant of bandJamVariants) {
      const teams = await TeamComposition.find({ eventName: variant })
        .populate('teamLeader', 'name email contactNo hasEntered')
        .sort({ createdAt: -1 });
      
      teamStats[variant] = {
        count: teams.length,
        teams: teams
      };
      
      allBandJamTeams = [...allBandJamTeams, ...teams];
      
      console.log(`\n🎵 "${variant}" - ${teams.length} teams:`);
      teams.forEach((team, idx) => {
        const leader = team.teamLeader;
        console.log(`   ${idx + 1}. "${team.teamName}" (Leader: ${leader?.name || 'Unknown'})`);
        console.log(`      Members: ${team.teamMembers ? team.teamMembers.length : 0}, Created: ${team.createdAt}`);
        console.log(`      Leader entered: ${leader?.hasEntered ? '✅' : '❌'}`);
      });
    }
    
    // 3. Check Event collection for BAND JAM event
    console.log('\n📊 STEP 3: CHECKING EVENT COLLECTION');
    console.log('-' .repeat(60));
    
    const bandJamEvents = await Event.find({
      name: { $regex: /band.*jam|jam.*band/i }
    });
    
    console.log(`🎯 BAND JAM events in Event collection: ${bandJamEvents.length}`);
    bandJamEvents.forEach((event, idx) => {
      console.log(`   ${idx + 1}. "${event.name}" - Category: ${event.category}`);
      console.log(`      Description: ${event.description || 'No description'}`);
      console.log(`      Date: ${event.date || 'No date'}, Prize: ${event.prize || 'No prize'}`);
    });
    
    // 4. Analyze admin panel logic issues
    console.log('\n📊 STEP 4: ADMIN PANEL FILTERING ANALYSIS');
    console.log('-' .repeat(60));
    
    // Simulate how admin panel might filter
    const possibleFilters = [
      'BAND JAM',
      'BANDJAM',
      'Band Jam',
      'band jam',
      'bandjam'
    ];
    
    console.log('🔍 Testing different filter approaches:');
    
    for (const filter of possibleFilters) {
      // Exact match
      const exactMatch = await TeamComposition.find({ eventName: filter });
      
      // Case insensitive regex
      const regexMatch = await TeamComposition.find({ 
        eventName: { $regex: new RegExp(`^${filter}$`, 'i') } 
      });
      
      // Contains match
      const containsMatch = await TeamComposition.find({ 
        eventName: { $regex: new RegExp(filter, 'i') } 
      });
      
      console.log(`   Filter: "${filter}"`);
      console.log(`      Exact match: ${exactMatch.length} teams`);
      console.log(`      Case insensitive: ${regexMatch.length} teams`);
      console.log(`      Contains match: ${containsMatch.length} teams`);
    }
    
    // 5. Check individual user registrations for BAND JAM
    console.log('\n📊 STEP 5: INDIVIDUAL USER REGISTRATIONS');
    console.log('-' .repeat(60));
    
    const individualBandJamUsers = await User.find({
      events: { $regex: /band.*jam|jam.*band/i }
    }).select('name email events hasEntered');
    
    console.log(`👤 Individual users registered for BAND JAM events: ${individualBandJamUsers.length}`);
    
    individualBandJamUsers.forEach((user, idx) => {
      const bandJamEvents = user.events.filter(event => 
        event.toLowerCase().includes('band') || event.toLowerCase().includes('jam')
      );
      console.log(`   ${idx + 1}. ${user.name} (${user.email})`);
      console.log(`      Events: ${bandJamEvents.join(', ')}`);
      console.log(`      Entered: ${user.hasEntered ? '✅' : '❌'}`);
    });
    
    // 6. Data consistency issues
    console.log('\n📊 STEP 6: DATA CONSISTENCY ANALYSIS');
    console.log('-' .repeat(60));
    
    const issues = [];
    
    // Check for inconsistent event names
    if (bandJamVariants.length > 1) {
      issues.push({
        type: 'INCONSISTENT_EVENT_NAMES',
        description: `Found ${bandJamVariants.length} different event name variants for BAND JAM`,
        variants: bandJamVariants,
        impact: 'Admin panel filtering may miss some teams',
        severity: 'HIGH'
      });
    }
    
    // Check for teams without leaders
    const teamsWithoutLeaders = allBandJamTeams.filter(team => !team.teamLeader);
    if (teamsWithoutLeaders.length > 0) {
      issues.push({
        type: 'MISSING_TEAM_LEADERS',
        description: `Found ${teamsWithoutLeaders.length} BAND JAM teams without team leaders`,
        teams: teamsWithoutLeaders.map(t => t.teamName),
        severity: 'MEDIUM'
      });
    }
    
    // Check for empty team member arrays
    const teamsWithoutMembers = allBandJamTeams.filter(team => 
      !team.teamMembers || team.teamMembers.length === 0
    );
    if (teamsWithoutMembers.length > 0) {
      issues.push({
        type: 'TEAMS_WITHOUT_MEMBERS',
        description: `Found ${teamsWithoutMembers.length} BAND JAM teams with no team members`,
        teams: teamsWithoutMembers.map(t => t.teamName),
        severity: 'LOW'
      });
    }
    
    // 7. Summary and recommendations
    console.log('\n📊 STEP 7: SUMMARY AND RECOMMENDATIONS');
    console.log('=' .repeat(80));
    
    console.log(`\n📈 STATISTICS:`);
    console.log(`   Total BAND JAM teams: ${allBandJamTeams.length}`);
    console.log(`   Event name variants: ${bandJamVariants.length}`);
    console.log(`   Individual registrations: ${individualBandJamUsers.length}`);
    console.log(`   Issues found: ${issues.length}`);
    
    console.log(`\n📋 DETAILED BREAKDOWN BY VARIANT:`);
    Object.entries(teamStats).forEach(([variant, stats]) => {
      console.log(`   "${variant}": ${stats.count} teams`);
    });
    
    console.log(`\n⚠️  ISSUES FOUND:`);
    if (issues.length === 0) {
      console.log(`   ✅ No major issues detected!`);
    } else {
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. [${issue.severity}] ${issue.type}`);
        console.log(`      ${issue.description}`);
        if (issue.variants) {
          console.log(`      Variants: ${issue.variants.join(', ')}`);
        }
        if (issue.teams) {
          console.log(`      Affected teams: ${issue.teams.join(', ')}`);
        }
      });
    }
    
    console.log(`\n🔧 RECOMMENDATIONS:`);
    
    if (bandJamVariants.length > 1) {
      console.log(`   1. STANDARDIZE EVENT NAMES:`);
      console.log(`      - Choose one standard format (recommend: "BAND JAM")`);
      console.log(`      - Update all team compositions to use the standard name`);
      console.log(`      - Update admin panel to handle legacy variants`);
    }
    
    console.log(`   2. ADMIN PANEL IMPROVEMENTS:`);
    console.log(`      - Use case-insensitive regex for event filtering`);
    console.log(`      - Add fuzzy matching for BAND JAM variants`);
    console.log(`      - Consider using event IDs instead of names for filtering`);
    
    console.log(`   3. DATA VALIDATION:`);
    console.log(`      - Add validation to ensure team leaders exist`);
    console.log(`      - Implement data migration script for cleanup`);
    console.log(`      - Add database constraints for consistency`);
    
    // 8. Generate fix script suggestions
    console.log('\n📊 STEP 8: GENERATING FIX SCRIPT');
    console.log('-' .repeat(60));
    
    if (bandJamVariants.length > 1) {
      console.log(`\n🔧 SQL-like commands to standardize event names:`);
      
      const standardName = "BAND JAM";
      for (const variant of bandJamVariants) {
        if (variant !== standardName) {
          const count = teamStats[variant].count;
          console.log(`   // Update ${count} teams from "${variant}" to "${standardName}"`);
          console.log(`   await TeamComposition.updateMany(`);
          console.log(`     { eventName: "${variant}" },`);
          console.log(`     { eventName: "${standardName}" }`);
          console.log(`   );`);
        }
      }
    }
    
    // 9. Export detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTeams: allBandJamTeams.length,
        eventVariants: bandJamVariants.length,
        individualUsers: individualBandJamUsers.length,
        issuesFound: issues.length
      },
      eventVariants: bandJamVariants,
      teamStats: teamStats,
      issues: issues,
      teams: allBandJamTeams.map(team => ({
        id: team._id,
        name: team.teamName,
        eventName: team.eventName,
        leaderName: team.teamLeader?.name,
        leaderEmail: team.teamLeader?.email,
        membersCount: team.teamMembers?.length || 0,
        createdAt: team.createdAt,
        hasEntered: team.teamLeader?.hasEntered || false
      })),
      individualUsers: individualBandJamUsers.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        events: user.events,
        hasEntered: user.hasEntered
      }))
    };
    
    // Save report to file
    const reportFileName = `band_jam_verification_report_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportFileName}`);
    
    console.log('\n🎉 BAND JAM VERIFICATION COMPLETED!');
    
    return {
      success: true,
      summary: report.summary,
      issues: issues,
      recommendations: bandJamVariants.length > 1 ? ['Standardize event names', 'Update admin panel filtering'] : ['No major issues found']
    };
    
  } catch (error) {
    console.error('❌ Error in BAND JAM verification:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { verifyBandJamTeams };

// Run the script if called directly
if (require.main === module) {
  verifyBandJamTeams();
}