/**
 * Email Service Configuration and Helper Functions
 * Handles email sending, templates, and configurations
 */

const nodemailer = require('nodemailer');

// Email configuration - Update these with your actual email credentials
const EMAIL_CONFIG = {
  // Gmail configuration
  gmail: {
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'your-gmail@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password' // Use App Password, not regular password
    }
  },
  
  // SMTP configuration (alternative)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'your-email@domain.com',
      pass: process.env.SMTP_PASS || 'your-password'
    }
  }
};

// Create email transporter
function createEmailTransporter() {
  try {
    // Try Gmail first
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      return nodemailer.createTransport(EMAIL_CONFIG.gmail);
    }
    
    // Fall back to SMTP
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport(EMAIL_CONFIG.smtp);
    }
    
    // Default to Gmail with env variables
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || process.env.GMAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD
      }
    });
  } catch (error) {
    console.error('❌ Error creating email transporter:', error.message);
    return null;
  }
}

// Enhanced email template with better styling
function createEmailTemplate(user, qrCode) {
  const eventsList = user.events && user.events.length > 0 
    ? user.events.map(event => `<li style="margin: 5px 0;">${event}</li>`).join('')
    : '<li>No events registered</li>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sabrang 2025 - Registration Confirmed</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎉 Sabrang 2025</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Registration Confirmed!</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${user.name}!</h2>
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            Thank you for registering for Sabrang 2025! We're excited to have you join us for this amazing event.
          </p>
          
          <!-- Registration Details -->
          <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">📋 Registration Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold; width: 120px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${user.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0; color: #333;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">Contact:</td>
                <td style="padding: 8px 0; color: #333;">${user.contactNo || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">University:</td>
                <td style="padding: 8px 0; color: #333;">${user.universityName || 'Not provided'}</td>
              </tr>
            </table>
          </div>
          
          <!-- Events List -->
          <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">🎯 Registered Events</h3>
            <ul style="margin: 0; padding-left: 20px; color: #333;">
              ${eventsList}
            </ul>
          </div>
          
          <!-- QR Code -->
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">📱 Your Entry QR Code</h3>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 2px dashed #ffc107; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Unique Entry Code:</p>
              <code style="background: #f8f9fa; padding: 8px 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; color: #e83e8c; word-break: break-all;">${qrCode}</code>
            </div>
            <p style="margin: 15px 0 0 0; color: #856404; font-size: 14px;">
              ⚠️ <strong>Important:</strong> Please save this QR code. You'll need it for event entry verification.
            </p>
          </div>
          
          <!-- Instructions -->
          <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">📝 Next Steps</h3>
            <ol style="margin: 0; color: #155724; line-height: 1.6;">
              <li>Save this email and your QR code</li>
              <li>Bring a valid ID for verification</li>
              <li>Arrive 30 minutes before your event time</li>
              <li>Check our website for event schedules and updates</li>
            </ol>
          </div>
          
          <!-- Footer Message -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 16px; margin-bottom: 5px;">
              Looking forward to seeing you at Sabrang 2025! 🎊
            </p>
            <p style="color: #888; font-size: 14px; margin: 0;">
              Best regards,<br>
              <strong>The Sabrang Team</strong>
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 12px;">
            This is an automated email. Please do not reply to this message.<br>
            For support, contact us at support@sabrang.jklu.edu.in
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send email with retry logic
async function sendEmailWithRetry(user, qrCode, maxRetries = 3) {
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    console.error('❌ Cannot create email transporter');
    return false;
  }
  
  const mailOptions = {
    from: {
      name: 'Sabrang 2025',
      address: process.env.EMAIL_USER || process.env.GMAIL_USER || 'noreply@sabrang.com'
    },
    to: user.email,
    subject: '🎉 Sabrang 2025 - Registration Confirmed',
    html: createEmailTemplate(user, qrCode),
    priority: 'normal'
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   📧 Sending email attempt ${attempt}/${maxRetries}...`);
      
      const info = await transporter.sendMail(mailOptions);
      console.log(`   ✅ Email sent successfully: ${info.messageId}`);
      return true;
      
    } catch (error) {
      console.error(`   ❌ Email attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`   💥 All ${maxRetries} email attempts failed for ${user.email}`);
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return false;
}

// Test email configuration
async function testEmailConfig() {
  console.log('🧪 Testing email configuration...');
  
  const transporter = createEmailTransporter();
  if (!transporter) {
    console.log('❌ Failed to create email transporter');
    return false;
  }
  
  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.log('❌ Email configuration test failed:', error.message);
    console.log('💡 Please check your email credentials in environment variables:');
    console.log('   - GMAIL_USER and GMAIL_APP_PASSWORD (for Gmail)');
    console.log('   - Or SMTP_HOST, SMTP_USER, SMTP_PASS (for custom SMTP)');
    return false;
  }
}

module.exports = {
  sendEmailWithRetry,
  createEmailTemplate,
  testEmailConfig,
  createEmailTransporter,
  EMAIL_CONFIG
};