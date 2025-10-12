/**
 * Test script for Sabrang 2025 instructions email
 * Sends to only first few emails for testing
 */

require('dotenv').config();
const { readEmailsFromCSV, generateSabrangInstructionsEmail, sendBatchEmails } = require('./send-sabrang-instructions-email');
const { MicrosoftOAuthMailer } = require('./utils/emailService');
const path = require('path');

async function testEmail() {
    try {
        console.log('🧪 Starting TEST mode for Sabrang 2025 Instructions Email');
        console.log('=' .repeat(50));

        // Configuration
        const config = {
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            tenantId: process.env.TENANT_ID,
            userEmail: process.env.FROM_EMAIL
        };

        // Validate environment variables
        const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Read emails from CSV
        const csvFilePath = path.join(__dirname, 'matched_emails_unique.csv');
        console.log(`📂 Reading email addresses from: ${csvFilePath}`);
        
        const allEmails = readEmailsFromCSV(csvFilePath);
        console.log(`📋 Found ${allEmails.length} total email addresses`);

        // Take only first 3 emails for testing
        const testEmails = allEmails.slice(0, 3);
        console.log(`🧪 Testing with first ${testEmails.length} emails:`);
        testEmails.forEach((email, index) => {
            console.log(`   ${index + 1}. ${email}`);
        });

        // Initialize mailer
        console.log('\n🔧 Initializing email service...');
        const mailer = new MicrosoftOAuthMailer(config);

        // Test access token
        await mailer.getAccessToken();
        console.log('✅ Email service initialized successfully');

        // Generate and display email content preview
        const { htmlContent, textContent } = generateSabrangInstructionsEmail();
        console.log('\n📧 Email Preview:');
        console.log('Subject: Important Instructions for Sabrang 2025 🎉');
        console.log('Content Type: HTML + Text');
        console.log(`Content Length: ${htmlContent.length} chars (HTML), ${textContent.length} chars (Text)`);

        console.log('\n⚠️  Sending test emails in 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Send test emails
        const startTime = Date.now();
        const results = await sendBatchEmails(mailer, testEmails, 3);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // Display results
        console.log('\n' + '='.repeat(40));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(40));
        console.log(`✅ Successfully sent: ${results.sent} emails`);
        console.log(`❌ Failed to send: ${results.failed} emails`);
        console.log(`📈 Success rate: ${((results.sent / results.total) * 100).toFixed(1)}%`);
        console.log(`⏱️  Total time: ${duration} seconds`);

        if (results.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.email} - ${error.error}`);
            });
        }

        if (results.sent > 0) {
            console.log('\n✅ Test completed successfully!');
            console.log('📧 Check the recipient email accounts to verify the email format and content.');
            console.log('📝 If everything looks good, you can run the full campaign with:');
            console.log('   node send-sabrang-instructions-email.js');
        } else {
            console.log('\n❌ Test failed. Please check the errors above and fix any issues.');
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    }
}

// Run test
if (require.main === module) {
    testEmail();
}