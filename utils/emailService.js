require('dotenv').config();
const nodemailer = require('nodemailer');
const axios = require('axios');

class MicrosoftOAuthMailer {
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.tenantId = config.tenantId;
        this.userEmail = config.userEmail;
        this.accessToken = null;
    }

    /**
     * Get OAuth2 access token from Microsoft
     */
    async getAccessToken() {
        const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('scope', process.env.OAUTH_SCOPE || 'https://graph.microsoft.com/.default');
        params.append('grant_type', 'client_credentials');

        try {
            const response = await axios.post(tokenUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            console.log('✅ Access token obtained successfully');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Error getting access token:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send email using Microsoft Graph API
     */
    async sendEmailGraph(mailOptions) {
        try {
            // Get fresh access token
            await this.getAccessToken();

            const graphUrl = `https://graph.microsoft.com/v1.0/users/${this.userEmail}/sendMail`;

            const emailPayload = {
                message: {
                    subject: mailOptions.subject,
                    body: {
                        contentType: mailOptions.html ? 'HTML' : 'Text',
                        content: mailOptions.html || mailOptions.text
                    },
                    toRecipients: Array.isArray(mailOptions.to) 
                        ? mailOptions.to.map(email => ({ emailAddress: { address: email } }))
                        : [{ emailAddress: { address: mailOptions.to } }],
                    ccRecipients: mailOptions.cc 
                        ? (Array.isArray(mailOptions.cc) 
                            ? mailOptions.cc.map(email => ({ emailAddress: { address: email } }))
                            : [{ emailAddress: { address: mailOptions.cc } }])
                        : [],
                    bccRecipients: mailOptions.bcc 
                        ? (Array.isArray(mailOptions.bcc) 
                            ? mailOptions.bcc.map(email => ({ emailAddress: { address: email } }))
                            : [{ emailAddress: { address: mailOptions.bcc } }])
                        : [],
                    attachments: mailOptions.attachments || []
                }
            };

            console.log('📧 Sending email via Graph API...');
            const response = await axios.post(graphUrl, emailPayload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Email sent successfully via Graph API');
            return response.data;

        } catch (error) {
            console.error('❌ Graph API Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

/**
 * Generate registration email content
 */
function generateRegistrationEmailContent(userData) {
    const { name, events, qrCodeBase64 } = userData;
    
    const eventsText = events && events.length > 0 
        ? events.join(', ') 
        : 'No events registered';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .qr-section { text-align: center; margin: 20px 0; }
            .qr-code { max-width: 200px; border: 2px solid #ddd; border-radius: 8px; }
            .footer { text-align: center; margin-top: 30px; color: #666; }
            .events-list { background: #e8f4fd; padding: 15px; border-left: 4px solid #2196f3; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome to Sabrang'25!</h1>
                <p>Thank you for registering with us</p>
            </div>
            
            <div class="content">
                <h2>Registration Confirmed!</h2>
                <p>Dear ${name},</p>
                <p>Thanks for registering for <strong>Sabrang'25</strong>. We're excited to have you join us for this amazing event!</p>
                
                <div class="details">
                    <h3>📋 Your Registration Details:</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <div class="events-list">
                        <strong>🎭 Events Registered For:</strong><br>
                        ${eventsText}
                    </div>
                </div>
                
                <div class="qr-section">
                    <h3>📱 Your QR Code</h3>
                    <p>Please present this QR code at the event entrance:</p>
                    ${qrCodeBase64 ? `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code" class="qr-code">` : '<p>QR Code will be available soon.</p>'}
                    <p><small>Save this email or take a screenshot for easy access</small></p>
                </div>
                
                <div class="footer">
                    <p>🎊 We look forward to seeing you at Sabrang'25!</p>
                    <p><strong>Team Sabrang'25</strong></p>
                    <hr>
                    <p><small>If you have any questions, please contact our support team.</small></p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
Thanks for registering for Sabrang'25!

Here are your registration details:

Name: ${name}
Events registered for: ${eventsText}

Please save your QR code for event entry.

Thanks,
Team Sabrang'25
    `;

    return { htmlContent, textContent };
}

/**
 * Send registration email to user
 */
async function sendRegistrationEmail(userEmail, userData) {
    try {
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

        const mailer = new MicrosoftOAuthMailer(config);
        const { htmlContent, textContent } = generateRegistrationEmailContent(userData);

        const mailOptions = {
            to: userEmail,
            subject: '🎉 Registration Confirmed - Sabrang\'25',
            text: textContent,
            html: htmlContent
        };

        const result = await mailer.sendEmailGraph(mailOptions);
        console.log(`✅ Registration email sent successfully to ${userEmail}`);
        return { success: true, result };

    } catch (error) {
        console.error(`❌ Failed to send registration email to ${userEmail}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Generate payment initiation email content (simplified like test-email.js)
 */
function generatePaymentInitiationEmailContent(paymentData) {
    const { name, orderId, amount, paymentSessionId, environment, qrCodeBase64, purchaseId } = paymentData;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🎉 Welcome to Sabrang'25!</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
            .highlight { color: #667eea; font-weight: bold; }
            .amount { font-size: 24px; color: #27ae60; font-weight: bold; }
            .qr-section { background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome to Sabrang'25!</h1>
                <h2>Thank you for registering with us</h2>
            </div>
            <div class="content">
                <h2>Registration Confirmed!</h2>
                <p><strong>Dear ${name},</strong></p>
                <p>Thanks for registering for Sabrang'25. We're excited to have you join us for this amazing event!</p>
                
                <div class="order-details">
                    <h3>📋 Your Registration Details:</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Order ID:</strong> <span class="highlight">${orderId}</span></p>
                    <p><strong>Amount Paid:</strong> <span class="amount">₹${amount}</span></p>
                </div>
                
                <div class="order-details">
                    <h3>🎭 Events Registered For:</h3>
                    <p>Demo Event</p>
                </div>
                
                <div class="qr-section">
                    <h3>📱 Your QR Code</h3>
                    <p>Please present this QR code at the event entrance:</p>
                    ${qrCodeBase64 ? `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code" style="max-width: 200px; border: 2px solid #ddd; border-radius: 8px;">` : `<p><strong>QR Code ID:</strong> ${purchaseId || orderId}</p>`}
                    <p><em>Save this email or take a screenshot for easy access</em></p>
                </div>
                
                <p><strong>� We look forward to seeing you at Sabrang'25!</strong></p>
                
                <p><strong>Team Sabrang'25</strong></p>
                
                <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>&copy; 2025 Sabrang'25 - JK Lakshmipat University</p>
                <p>For support: support@sabrang.com</p>
            </div>
        </div>
    </body>
    </html>`;

    const textContent = `
🎉 Welcome to Sabrang'25!
Thank you for registering with us

Registration Confirmed!
Dear ${name},

Thanks for registering for Sabrang'25. We're excited to have you join us for this amazing event!

📋 Your Registration Details:
Name: ${name}

🎭 Events Registered For:
Demo Event

📱 Your QR Code
Please present this QR code at the event entrance:

${qrCodeBase64 ? 'QR Code attached above in the HTML version' : `QR Code ID: ${purchaseId || orderId}`}
Save this email or take a screenshot for easy access

🎊 We look forward to seeing you at Sabrang'25!

Team Sabrang'25

If you have any questions, please contact our support team.

© 2025 Sabrang'25 - JK Lakshmipat University
For support: support@sabrang.com`;

    return { htmlContent, textContent };
}

/**
 * Send payment initiation email (using same pattern as working test-email.js)
 */
async function sendPaymentInitiatedEmail(paymentData) {
    const { email: userEmail } = paymentData;
    
    try {
        // Use the same configuration pattern as the working test-email.js
        const config = {
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            tenantId: process.env.TENANT_ID,
            userEmail: process.env.FROM_EMAIL
        };

        // Validate required environment variables (same as test-email.js)
        const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Use the same mailer pattern as test-email.js
        const mailer = new MicrosoftOAuthMailer(config);
        const { htmlContent, textContent } = generatePaymentInitiationEmailContent(paymentData);

        const mailOptions = {
            to: userEmail,
            subject: '🎉 Welcome to Sabrang\'25! Registration Confirmed',
            text: textContent,
            html: htmlContent
        };

        // Use the same sending method as test-email.js
        const result = await mailer.sendEmailGraph(mailOptions);
        console.log(`✅ Payment initiation email sent successfully to ${userEmail}`);
        return { success: true, result };

    } catch (error) {
        console.error(`❌ Failed to send payment initiation email to ${userEmail}:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    MicrosoftOAuthMailer,
    generateRegistrationEmailContent,
    sendRegistrationEmail,
    generatePaymentInitiationEmailContent,
    sendPaymentInitiatedEmail
};
