# Sabrang 2025 Instructions Email Campaign

This folder contains scripts to send important instructions email to participants registered for Sabrang 2025.

## Files Created

1. **send-sabrang-instructions-email.js** - Main script to send emails to all participants
2. **test-sabrang-instructions-email.js** - Test script to send to first 3 emails only
3. **matched_emails_unique.csv** - CSV file containing email addresses (already present)

## Email Content

The email includes:
- **Subject**: Important Instructions for Sabrang 2025 🎉
- **Important ID Card Requirement**: Mandatory institution ID card for entry
- **Ticket Download Link**: https://sabrang.jklu.edu.in/ticket
- **Code of Conduct**: Reference to Sabrang website guidelines
- **Issue Reporting**: Form link for assistance
- **Professional HTML formatting** with Sabrang branding

## Usage

### Step 1: Test First (Recommended)
```bash
node test-sabrang-instructions-email.js
```
This will send the email to only the first 3 email addresses for testing.

### Step 2: Run Full Campaign
```bash
node send-sabrang-instructions-email.js
```
This will send emails to all email addresses in the CSV file.

## Features

- **Batch Processing**: Sends emails in batches of 10 with 2-second delays
- **Error Handling**: Continues even if some emails fail
- **Progress Tracking**: Shows real-time progress and statistics
- **Report Generation**: Creates detailed JSON report of results
- **HTML + Text Format**: Professional email with fallback text version
- **Rate Limiting**: Built-in delays to avoid overwhelming email servers

## Requirements

Make sure your `.env` file has:
```
CLIENT_ID=your_microsoft_client_id
CLIENT_SECRET=your_microsoft_client_secret
TENANT_ID=your_microsoft_tenant_id
FROM_EMAIL=your_sending_email@domain.com
```

## Output

The script will:
1. Show progress for each batch of emails
2. Display final statistics (sent/failed counts, success rate, timing)
3. List any failed emails with error messages
4. Save detailed report to JSON file

## Safety Features

- 5-second confirmation delay before starting full campaign
- Ctrl+C to cancel at any time
- Detailed error logging
- Batch processing to avoid overwhelming servers
- Test mode for validation

## Email Statistics Expected

- **Total Recipients**: ~370 email addresses from CSV
- **Estimated Time**: ~2-3 minutes (with batching and delays)
- **Success Rate**: Typically 95%+ (depends on email validity)

## Troubleshooting

1. **Authentication Errors**: Check your Microsoft OAuth credentials in .env
2. **Rate Limiting**: Script includes delays, but you can increase them if needed
3. **Invalid Emails**: Failed emails will be logged in the report
4. **Network Issues**: Script will retry and continue with remaining emails

## Post-Campaign

After running, check:
1. **Console output** for immediate results
2. **JSON report file** for detailed analysis
3. **Failed emails log** if any addresses had issues
4. **Recipient feedback** to ensure emails were received properly