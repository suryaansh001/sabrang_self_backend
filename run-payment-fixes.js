#!/usr/bin/env node
/**
 * Payment Fixes Runner Script
 * Executes the payment fix scripts in order
 */

const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...`);
    const child = exec(`node ${scriptName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error running ${scriptName}:`, error);
        reject(error);
      } else {
        console.log(`✅ ${scriptName} completed successfully`);
        resolve({ stdout, stderr });
      }
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

async function main() {
  console.log('🔧 Payment Status Fix Scripts');
  console.log('=====================================');
  
  try {
    // Ask which script to run
    console.log('\nSelect which script to run:');
    console.log('1. Fix Himani Saraf specific case (fix-himani-qr.js)');
    console.log('2. Check all pending payments (check-pending-payments.js)');
    console.log('3. Run both scripts');
    
    const choice = await new Promise(resolve => {
      rl.question('\nEnter your choice (1-3): ', resolve);
    });

    switch (choice) {
      case '1':
        await runScript('fix-himani-qr.js');
        break;
      case '2':
        await runScript('check-pending-payments.js');
        break;
      case '3':
        console.log('\n📋 Running both scripts in sequence...');
        await runScript('fix-himani-qr.js');
        console.log('\n⏳ Waiting 5 seconds before running general check...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await runScript('check-pending-payments.js');
        break;
      default:
        console.log('❌ Invalid choice. Exiting.');
        process.exit(1);
    }

    console.log('\n✅ All selected scripts completed successfully!');
    console.log('\n📧 Check your email for any QR codes that were sent.');
    console.log('🔍 Users should now be able to access their QR codes at: /api/qrcode/{userId}');
    
  } catch (error) {
    console.error('\n❌ Script execution failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Script interrupted by user');
  rl.close();
  process.exit(0);
});

main();