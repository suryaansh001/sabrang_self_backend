# Email Management System

This system provides automated registration email functionality for Sabrang'25 using Microsoft Graph API and OAuth2 authentication.

## Features

- 📧 Send beautiful HTML registration emails with QR codes
- 👥 Support for both individual users and team members
- 📊 Admin dashboard to track email status
- 🔄 Bulk email sending capability
- 🔐 Secure Microsoft OAuth2 authentication
- ⚡ Rate limiting to prevent overwhelming email services

## Setup Instructions

### 1. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Sabrang Email Service
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Not needed for this setup
5. After creation, note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### 2. Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and set expiry
4. **Copy the secret value immediately** (it won't be shown again)

### 3. Grant Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Choose **Microsoft Graph**
4. Select **Application permissions**
5. Add these permissions:
   - `Mail.Send`
   - `Mail.ReadWrite`
   - `User.Read.All` (if needed)
6. Click **Grant admin consent** for your organization

### 4. Environment Variables

Create a `.env` file in the backend root with:

```env
# Microsoft OAuth2 Email Configuration
CLIENT_ID=your_application_client_id
CLIENT_SECRET=your_client_secret_value
TENANT_ID=your_directory_tenant_id
FROM_EMAIL=noreply@yourdomain.com
OAUTH_SCOPE=https://graph.microsoft.com/.default
```

### 5. Configure Sender Email

The `FROM_EMAIL` should be a valid email address in your organization that has a mailbox in Microsoft 365/Outlook.

## API Endpoints

### Admin Email Management

#### Get Users with Email Status
```http
GET /admin/users-email-status
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "events": ["Event 1", "Event 2"],
      "emailSent": false,
      "emailSentAt": null,
      "emailSentBy": null,
      "qrPath": "/public/qrcodes/user_id.png"
    }
  ],
  "totalUsers": 100,
  "emailsSent": 25,
  "emailsPending": 75
}
```

#### Get Team Members with Email Status
```http
GET /admin/team-members-email-status
Authorization: Bearer {admin_token}
```

#### Send Email to Specific User
```http
POST /admin/send-email/{userId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userType": "user" // or "team-member"
}
```

#### Send Bulk Emails
```http
POST /admin/send-bulk-emails
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "targetType": "users" // "users", "team-members", or "both"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk email sending completed",
  "results": {
    "totalProcessed": 100,
    "successful": 95,
    "failed": 5,
    "errors": ["John Doe (john@example.com): Invalid email address"]
  }
}
```

#### Reset Email Status
```http
POST /admin/reset-email-status/{userId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userType": "user" // or "team-member"
}
```

## Email Template

The system sends a beautifully formatted HTML email containing:

- **Welcome message** for Sabrang'25
- **User's name**
- **List of registered events**
- **QR code image** (embedded as base64)
- **Professional styling** with gradients and responsive design

### Email Content Structure:
```
🎉 Welcome to Sabrang'25!

Dear [Name],

Thanks for registering for Sabrang'25. We're excited to have you join us!

📋 Your Registration Details:
Name: [User Name]
🎭 Events Registered For: [Event1, Event2, ...]

📱 Your QR Code
[QR Code Image]
Please present this QR code at the event entrance.

🎊 We look forward to seeing you at Sabrang'25!
Team Sabrang'25
```

## Database Schema Updates

The following fields have been added to track email status:

### User Model
```javascript
emailSent: { type: Boolean, default: false },
emailSentAt: { type: Date, default: null },
emailSentBy: { type: ObjectId, ref: 'User', default: null }
```

### TeamMember Model
```javascript
emailSent: { type: Boolean, default: false },
emailSentAt: { type: Date, default: null },
emailSentBy: { type: ObjectId, ref: 'User', default: null }
```

## Error Handling

The system includes comprehensive error handling for:
- Missing environment variables
- Invalid OAuth2 credentials
- Email service failures
- Missing QR codes
- Network timeouts
- Rate limiting

## Security Features

- ✅ OAuth2 authentication with Microsoft
- ✅ Admin-only access to email functions
- ✅ Input validation and sanitization
- ✅ Rate limiting between email sends
- ✅ Secure token handling
- ✅ No plain text email credentials

## Testing

Use the test function in the email service:

```bash
cd backend_old/sabrang_self_backend
node -e "
const { sendRegistrationEmail } = require('./utils/emailService');
sendRegistrationEmail('test@example.com', {
  name: 'Test User',
  events: ['Event 1', 'Event 2'],
  qrCodeBase64: null
}).then(console.log);
"
```

## Troubleshooting

### Common Issues:

1. **"Missing required environment variables"**
   - Ensure all required environment variables are set in `.env`

2. **"Access token failed"**
   - Check Azure app registration permissions
   - Verify client ID, secret, and tenant ID
   - Ensure admin consent is granted

3. **"Email sending failed"**
   - Verify FROM_EMAIL is a valid mailbox in your organization
   - Check Microsoft 365 admin center for any restrictions

4. **"QR code not found"**
   - Emails will still send without QR codes
   - Check if QR code files exist in `/public/qrcodes/`

### Monitoring

Check the console logs for detailed information:
- ✅ Success messages with green checkmarks
- ❌ Error messages with red X marks
- 📧 Email sending progress
- 🔑 Token acquisition status

## Production Considerations

1. **Rate Limiting**: Built-in 1-second delay between emails
2. **Monitoring**: Log all email activities
3. **Backup**: Consider backup email service
4. **Scaling**: Microsoft Graph API has generous limits
5. **Compliance**: Ensure GDPR/privacy compliance

## Support

For issues with this email system, check:
1. Console logs for detailed error messages
2. Azure portal for any service issues
3. Microsoft Graph API status
4. Environment variable configuration
