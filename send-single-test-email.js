/**
 * Single test email to suryaanshsharma@jklu.edu.in
 * for Sabrang 2025 instructions email verification
 */

require('dotenv').config();
const { generateSabrangInstructionsEmail } = require('./send-sabrang-instructions-email');
const { MicrosoftOAuthMailer } = require('./utils/emailService');

async function sendSingleTestEmail() {
    try {
        console.log('📧 Sending single test email to suryaanshsharma@jklu.edu.in');
        console.log('=' .repeat(60));

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

        // Test email address
        const testEmail = 'suryaanshsharma@jklu.edu.in';
        console.log(`📧 Target email: ${testEmail}`);

        // Initialize mailer
        console.log('\n🔧 Initializing email service...');
        const mailer = new MicrosoftOAuthMailer(config);

        // Test access token
        await mailer.getAccessToken();
        console.log('✅ Email service initialized successfully');

        // Generate email content
        const { htmlContent, textContent } = generateSabrangInstructionsEmail();
        console.log('\n📧 Email Content:');
        console.log('Subject: Important Instructions for Sabrang 2025 🎉');
        console.log('✅ Dress code references removed');
        console.log('✅ Issue form link updated');
        console.log(`Content: ${textContent.length} chars (text), ${htmlContent.length} chars (HTML)`);

        console.log('\n📤 Sending email...');

        // Send email
        const mailOptions = {
            to: testEmail,
            subject: 'Important Instructions for Sabrang 2025 🎉',
            text: textContent,
            html: htmlContent
        };

        const startTime = Date.now();
        await mailer.sendEmailGraph(mailOptions);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`✅ Email sent successfully to ${testEmail}`);
        console.log(`⏱️  Time taken: ${duration} seconds`);

        console.log('\n📋 Email Summary:');
        console.log('• ID Card requirement: ✅ Emphasized');
        console.log('• Ticket download link: ✅ https://sabrang.jklu.edu.in/ticket');
        console.log('• Issue form link: ✅ Google Form added');
        console.log('• Dress code: ❌ Removed as requested');
        console.log('• Code of conduct: ✅ Website reference only');

        console.log('\n🎉 Single test email completed successfully!');
        console.log('📨 Please check suryaanshsharma@jklu.edu.in for the email');
        console.log('📝 If the content looks good, run the full campaign with:');
        console.log('   node send-sabrang-instructions-email.js');

    } catch (error) {
        console.error('\n❌ TEST EMAIL FAILED:', error.message);
        process.exit(1);
    }
}

// Run single test
if (require.main === module) {
    sendSingleTestEmail();
}