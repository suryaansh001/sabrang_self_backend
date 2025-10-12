/**
 * Script to send Sabrang 2025 important instructions email
 * to specific email addresses from matched_emails_unique.csv
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MicrosoftOAuthMailer } = require('./utils/emailService');

// Read CSV file and extract email addresses
function readEmailsFromCSV(csvFilePath) {
    try {
        const csvContent = fs.readFileSync(csvFilePath, 'utf8');
        const lines = csvContent.split('\n');
        
        // Skip header row and filter out empty lines
        const emails = lines
            .slice(1) // Skip header
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.split(',')[0]) // Get first column (email)
            .filter(email => email && email.includes('@'));
        
        return emails;
    } catch (error) {
        console.error('❌ Error reading CSV file:', error.message);
        throw error;
    }
}

// Generate the specific email content for Sabrang instructions
function generateSabrangInstructionsEmail() {
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Important Instructions for Sabrang 2025 🎉</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #ffffff; 
                margin: 0; 
                padding: 0; 
                background-color: #1e3a8a;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #1e3a8a; 
                border-radius: 10px; 
                overflow: hidden; 
                border: 2px solid #60a5fa;
            }
            .header { 
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
                color: white; 
                padding: 30px; 
                text-align: center; 
            }
            .content { 
                padding: 30px; 
                background-color: #2563eb; 
                color: #ffffff;
            }
            .instruction-section { 
                background-color: #1d4ed8; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
                border: 2px solid #60a5fa;
            }
            .ticket-section { 
                background-color: #1e40af; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
                text-align: center; 
                border: 2px solid #60a5fa;
            }
            .ticket-button { 
                display: inline-block; 
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); 
                color: #1e3a8a; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 25px; 
                font-weight: bold; 
                margin: 10px 0; 
                border: 2px solid #fcd34d;
            }
            .form-button { 
                display: inline-block; 
                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); 
                color: #ffffff; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 25px; 
                font-weight: bold; 
                margin: 10px 0; 
                border: 2px solid #fca5a5;
            }
            .footer { 
                text-align: center; 
                margin-top: 30px; 
                color: #e0e7ff; 
                background-color: #1e40af; 
                padding: 20px; 
                border-radius: 8px; 
                border: 2px solid #60a5fa;
            }
            .important-notice { 
                background-color: #dc2626; 
                border: 2px solid #fca5a5; 
                color: #ffffff; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
                text-align: center;
            }
            .instruction-list {
                background-color: #3730a3; 
                color: #ffffff; 
                padding: 20px; 
                border-left: 4px solid #fbbf24; 
                margin: 15px 0; 
                border-radius: 8px;
            }
            h1, h2, h3 { color: #ffffff; }
            p { color: #ffffff; }
            strong { color: #fbbf24; }
            ul { color: #ffffff; margin: 10px 0; }
            li { color: #ffffff; margin: 5px 0; }
            a { color: #1e3a8a; text-decoration: none; }
            .highlight { background-color: #fbbf24; color: #1e3a8a; padding: 2px 6px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Important Instructions for Sabrang 2025</h1>
                <p>Your guide to a smooth and enjoyable fest experience</p>
            </div>
            
            <div class="content">
                <h2>Dear Participant,</h2>
                <p>Thank you for registering for <strong>Sabrang 2025</strong>! We're thrilled to have you join us for an exciting and memorable fest. Please take a moment to read the following important instructions:</p>
                
                <div class="important-notice">
                    <h3>🆔 MANDATORY REQUIREMENT</h3>
                    <p><strong>Carry your Institution ID card at all times during the event.</strong></p>
                    <p><span class="highlight">Entry will not be permitted without a valid ID card.</span></p>
                </div>
                
                <div class="ticket-section">
                    <h3>🎫 Your Digital Ticket</h3>
                    <p>You can download or view your ticket here:</p>
                    <a href="https://sabrang.jklu.edu.in/ticket" class="ticket-button">🎫 Download Your Ticket</a>
                    <p><em>Keep your ticket handy for easy entry!</em></p>
                </div>
                
                <div class="instruction-section">
                    <h3>📋 Important Guidelines</h3>
                    <div class="instruction-list">
                        <ul>
                            <li><strong>📱 Keep your ticket accessible:</strong> Have your digital ticket ready on your phone or printed copy</li>
                            <li><strong>🆔 ID Card mandatory:</strong> Bring your valid institution ID card - no entry without it!</li>
                            <li><strong>⏰ Arrive on time:</strong> Check event timings and arrive accordingly</li>
                            <li><strong> Stay connected:</strong> Keep emergency contact numbers handy</li>
                        </ul>
                    </div>
                </div>
                
                <div class="instruction-section">
                    <h3>❓ Need Help?</h3>
                    <p>If you face any issues or need assistance, kindly fill out this form:</p>
                    <div style="text-align: center; margin: 15px 0;">
                        <a href="https://docs.google.com/forms/d/e/1FAIpQLSfFAMfjPFFSDhZadP8PW_1t1hTeXCs0ikzLZ483gxmYo5TZHw/viewform?usp=header" class="form-button">📝 Issue Reporting Form</a>
                    </div>
                    <p><em>Our team will respond promptly to resolve any concerns.</em></p>
                </div>
                
                <div class="instruction-section">
                    <h3>🤝 Code of Conduct</h3>
                    <p>Please follow the general code of conduct mentioned on the <strong>Sabrang website</strong>. Your cooperation will help us ensure a smooth and enjoyable experience for everyone.</p>
                </div>
                
                <div class="footer">
                    <p><strong>🎊 Looking forward to seeing you at Sabrang 2025!</strong></p>
                    <p>Your cooperation will help us ensure a smooth and enjoyable experience for everyone.</p>
                    
                    <p><strong>Best regards,<br>Team Sabrang<br>✨ Witness the Unseen</strong></p>
                    
                    <p style="margin-top: 20px; font-size: 14px; color: #cbd5e1;">
                        <em>This is an important notification email. Please save these instructions for reference during the event.</em>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
Important Instructions for Sabrang 2025 🎉

Dear Participant,

Thank you for registering for Sabrang 2025! We're thrilled to have you join us for an exciting and memorable fest. Please take a moment to read the following important instructions:

🆔 MANDATORY REQUIREMENT:
Carry your Institution ID card at all times during the event. Entry will not be permitted without a valid ID card.

🎫 Your Digital Ticket:
You can download or view your ticket here: https://sabrang.jklu.edu.in/ticket

📋 Important Guidelines:
• Keep your ticket accessible - Have your digital ticket ready on your phone or printed copy
• ID Card mandatory - Bring your valid institution ID card - no entry without it!
• Arrive on time - Check event timings and arrive accordingly
• Stay connected - Keep emergency contact numbers handy

❓ Need Help?
If you face any issues or need assistance, kindly fill out this form: https://docs.google.com/forms/d/e/1FAIpQLSfFAMfjPFFSDhZadP8PW_1t1hTeXCs0ikzLZ483gxmYo5TZHw/viewform?usp=header
Our team will respond promptly to resolve any concerns.

🤝 Code of Conduct:
Please follow the general code of conduct mentioned on the Sabrang website. Your cooperation will help us ensure a smooth and enjoyable experience for everyone.

🎊 Looking forward to seeing you at Sabrang 2025!

Best regards,
Team Sabrang
✨ Witness the Unseen

This is an important notification email. Please save these instructions for reference during the event.
    `;

    return { htmlContent, textContent };
}

// Send email to a batch of recipients
async function sendBatchEmails(mailer, emails, batchSize = 10) {
    const results = {
        total: emails.length,
        sent: 0,
        failed: 0,
        errors: []
    };

    console.log(`📧 Starting to send emails to ${emails.length} recipients in batches of ${batchSize}`);

    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(emails.length/batchSize)} (${batch.length} emails)`);

        const batchPromises = batch.map(async (email, index) => {
            try {
                const { htmlContent, textContent } = generateSabrangInstructionsEmail();
                
                const mailOptions = {
                    to: email,
                    subject: 'Important Instructions for Sabrang 2025 🎉',
                    text: textContent,
                    html: htmlContent
                };

                await mailer.sendEmailGraph(mailOptions);
                console.log(`✅ Email sent successfully to ${email}`);
                return { email, success: true };
                
            } catch (error) {
                console.error(`❌ Failed to send email to ${email}:`, error.message);
                return { email, success: false, error: error.message };
            }
        });

        // Wait for all emails in current batch to complete
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    results.sent++;
                } else {
                    results.failed++;
                    results.errors.push({
                        email: result.value.email,
                        error: result.value.error
                    });
                }
            } else {
                results.failed++;
                results.errors.push({
                    email: batch[index],
                    error: result.reason.message
                });
            }
        });

        console.log(`📊 Batch ${Math.floor(i/batchSize) + 1} completed. Sent: ${results.sent}, Failed: ${results.failed}`);

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < emails.length) {
            console.log('⏳ Waiting 2 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    return results;
}

// Main function
async function main() {
    try {
        console.log('🚀 Starting Sabrang 2025 Instructions Email Campaign');
        console.log('=' .repeat(50));

        // Configuration from environment variables
        const config = {
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            tenantId: process.env.TENANT_ID,
            userEmail: process.env.FROM_EMAIL
        };

        // Validate required environment variables
        const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Read email addresses from CSV file
        const csvFilePath = path.join(__dirname, 'matched_emails_unique.csv');
        console.log(`📂 Reading email addresses from: ${csvFilePath}`);
        
        const emails = readEmailsFromCSV(csvFilePath);
        console.log(`📋 Found ${emails.length} email addresses in CSV file`);

        if (emails.length === 0) {
            throw new Error('No valid email addresses found in CSV file');
        }

        // Display first few emails for confirmation
        console.log('\n📝 Sample email addresses:');
        emails.slice(0, 5).forEach((email, index) => {
            console.log(`   ${index + 1}. ${email}`);
        });
        if (emails.length > 5) {
            console.log(`   ... and ${emails.length - 5} more`);
        }

        // Initialize mailer
        console.log('\n🔧 Initializing email service...');
        const mailer = new MicrosoftOAuthMailer(config);

        // Get access token to verify configuration
        await mailer.getAccessToken();
        console.log('✅ Email service initialized successfully');

        // Ask for confirmation (you can remove this in automated environments)
        console.log('\n⚠️  CONFIRMATION REQUIRED ⚠️');
        console.log(`About to send "Important Instructions for Sabrang 2025" email to ${emails.length} recipients`);
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('✅ Proceeding with email campaign...\n');

        // Send emails in batches
        const startTime = Date.now();
        const results = await sendBatchEmails(mailer, emails, 10);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // Display final results
        console.log('\n' + '='.repeat(50));
        console.log('📊 EMAIL CAMPAIGN RESULTS');
        console.log('='.repeat(50));
        console.log(`✅ Successfully sent: ${results.sent} emails`);
        console.log(`❌ Failed to send: ${results.failed} emails`);
        console.log(`📈 Success rate: ${((results.sent / results.total) * 100).toFixed(1)}%`);
        console.log(`⏱️  Total time: ${duration} seconds`);
        console.log(`📧 Average: ${(results.total / (duration / 60)).toFixed(1)} emails/minute`);

        // Display errors if any
        if (results.errors.length > 0) {
            console.log('\n❌ FAILED EMAILS:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.email} - ${error.error}`);
            });
        }

        // Save results to file
        const reportPath = path.join(__dirname, `sabrang-instructions-email-report-${new Date().toISOString().split('T')[0]}.json`);
        const report = {
            campaign: 'Sabrang 2025 Instructions Email',
            timestamp: new Date().toISOString(),
            results: results,
            duration: duration,
            configuration: {
                totalEmails: emails.length,
                batchSize: 10,
                fromEmail: config.userEmail
            }
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        console.log('\n🎉 Email campaign completed successfully!');

    } catch (error) {
        console.error('\n❌ CAMPAIGN FAILED:', error.message);
        process.exit(1);
    }
}

// Handle script interruption
process.on('SIGINT', () => {
    console.log('\n⚠️  Email campaign interrupted by user');
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    readEmailsFromCSV,
    generateSabrangInstructionsEmail,
    sendBatchEmails,
    main
};