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

module.exports = {
    MicrosoftOAuthMailer,
    generateRegistrationEmailContent,
    sendRegistrationEmail
};
