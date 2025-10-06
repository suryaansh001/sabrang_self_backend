const fs = require('fs');
const path = require('path');

// Function to escape CSV fields
function escapeCSV(field) {
    if (!field) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Function to process team compositions JSON and convert to CSV
function processTeamCompositions(inputFile, outputFile) {
    console.log(`📖 Reading team compositions from: ${inputFile}`);
    
    if (!fs.existsSync(inputFile)) {
        console.error(`❌ File not found: ${inputFile}`);
        return;
    }
    
    try {
        const fileContent = fs.readFileSync(inputFile, 'utf8');
        const lines = fileContent.trim().split('\n');
        
        const csvRows = [];
        const headers = [
            'eventName',
            'teamName', 
            'totalMembers',
            'registrationComplete',
            'memberType',
            'memberName',
            'memberEmail',
            'memberContactNo',
            'memberRole',
            'hasEntered',
            'createdAt'
        ];
        
        // Add CSV header
        csvRows.push(headers.join(','));
        
        let totalMembers = 0;
        let totalTeams = 0;
        
        lines.forEach((line, index) => {
            try {
                const team = JSON.parse(line);
                totalTeams++;
                
                const baseInfo = {
                    eventName: escapeCSV(team.eventName || ''),
                    teamName: escapeCSV(team.teamName || ''),
                    totalMembers: escapeCSV(team.totalMembers || ''),
                    registrationComplete: escapeCSV(team.registrationComplete || false),
                    createdAt: escapeCSV(team.createdAt || '')
                };
                
                // Add team leader
                if (team.teamLeader) {
                    const leader = team.teamLeader;
                    totalMembers++;
                    csvRows.push([
                        baseInfo.eventName,
                        baseInfo.teamName,
                        baseInfo.totalMembers,
                        baseInfo.registrationComplete,
                        escapeCSV('Team Leader'),
                        escapeCSV(leader.name || ''),
                        escapeCSV(leader.email || ''),
                        escapeCSV(leader.contactNo || ''),
                        escapeCSV('Leader'),
                        escapeCSV(leader.hasEntered || false),
                        baseInfo.createdAt
                    ].join(','));
                }
                
                // Add team members
                if (team.teamMembers && Array.isArray(team.teamMembers)) {
                    team.teamMembers.forEach(member => {
                        totalMembers++;
                        csvRows.push([
                            baseInfo.eventName,
                            baseInfo.teamName,
                            baseInfo.totalMembers,
                            baseInfo.registrationComplete,
                            escapeCSV('Team Member'),
                            escapeCSV(member.name || ''),
                            escapeCSV(member.email || ''),
                            escapeCSV(member.contactNo || ''),
                            escapeCSV(member.role || 'Member'),
                            escapeCSV(member.hasEntered || false),
                            baseInfo.createdAt
                        ].join(','));
                    });
                }
                
            } catch (parseError) {
                console.error(`❌ Error parsing line ${index + 1}:`, parseError.message);
            }
        });
        
        // Write CSV file
        fs.writeFileSync(outputFile, csvRows.join('\n'), 'utf8');
        
        console.log(`✅ Team compositions CSV created: ${outputFile}`);
        console.log(`📊 Summary: ${totalTeams} teams, ${totalMembers} total members`);
        
        return { totalTeams, totalMembers };
        
    } catch (error) {
        console.error(`❌ Error processing team compositions:`, error);
    }
}

// Function to get the latest files
function getLatestFiles() {
    const allFiles = fs.readdirSync('.');
    
    // Find the most recent teamcompositions JSON file
    const teamJsonFiles = allFiles.filter(f => f.startsWith('teamcompositions_') && f.endsWith('.json'))
                                  .sort()
                                  .reverse(); // Get newest first
    
    const usersCsvFiles = allFiles.filter(f => f.startsWith('users_') && f.endsWith('.csv'))
                                  .sort()
                                  .reverse();
    
    const purchasesCsvFiles = allFiles.filter(f => f.startsWith('purchases_') && f.endsWith('.csv'))
                                      .sort()
                                      .reverse();
    
    console.log(`🔍 Looking for latest export files...`);
    console.log(`📁 Team JSON files: ${teamJsonFiles.join(', ')}`);
    console.log(`📁 Users CSV files: ${usersCsvFiles.join(', ')}`);
    console.log(`📁 Purchases CSV files: ${purchasesCsvFiles.join(', ')}`);
    
    const result = {
        teamCompositionsJson: teamJsonFiles[0] || null,
        usersCSV: usersCsvFiles[0] || null,
        purchasesCSV: purchasesCsvFiles[0] || null
    };
    
    console.log(`📄 Using team compositions JSON: ${result.teamCompositionsJson || 'NOT FOUND'}`);
    
    return result;
}

// Main function
function main() {
    console.log('🔄 Processing exported MongoDB data...\n');
    
    const files = getLatestFiles();
    
    if (files.teamCompositionsJson) {
        const outputFile = files.teamCompositionsJson.replace('.json', '_detailed.csv');
        const stats = processTeamCompositions(files.teamCompositionsJson, outputFile);
        
        if (stats) {
            console.log('\n📋 Team Registrations Summary:');
            console.log(`   Teams: ${stats.totalTeams}`);
            console.log(`   Total Members (including leaders): ${stats.totalMembers}`);
        }
    } else {
        console.log('⚠️ No team compositions JSON file found. Run the export script first.');
    }
    
    console.log('\n📁 Available files:');
    const allFiles = fs.readdirSync('.').filter(f => 
        f.endsWith('.csv') || f.endsWith('.json')
    ).filter(f => 
        f.includes('users_') || f.includes('teamcompositions_') || f.includes('purchases_')
    );
    
    allFiles.forEach(file => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`   📄 ${file} (${size} KB)`);
    });
    
    console.log('\n✅ Processing completed!');
    console.log('\nℹ️ Files explanation:');
    console.log('   📄 users_*.csv - Individual user registrations');
    console.log('   📄 teamcompositions_*_detailed.csv - All team members with details');
    console.log('   📄 purchases_*.csv - Payment information');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { processTeamCompositions, getLatestFiles };