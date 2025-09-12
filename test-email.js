require('dotenv').config();
const { sendRegistrationEmail, MicrosoftOAuthMailer } = require('./utils/emailService');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Function to validate environment variables
function validateEnvironment() {
    log('\n🔍 Validating Environment Variables...', 'cyan');
    
    const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'FROM_EMAIL'];
    const missingVars = [];
    
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
            log(`❌ Missing: ${varName}`, 'red');
        } else {
            log(`✅ Found: ${varName}`, 'green');
        }
    });
    
    if (missingVars.length > 0) {
        log('\n❌ Missing required environment variables:', 'red');
        log('Please add these to your .env file:', 'yellow');
        missingVars.forEach(varName => {
            log(`${varName}=your_${varName.toLowerCase()}_value`, 'yellow');
        });
        return false;
    }
    
    log('\n✅ All required environment variables are present!', 'green');
    return true;
}

// Function to test OAuth2 token acquisition
async function testOAuth2Token() {
    log('\n🔑 Testing OAuth2 Token Acquisition...', 'cyan');
    
    try {
        const config = {
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            tenantId: process.env.TENANT_ID,
            userEmail: process.env.FROM_EMAIL
        };
        
        const mailer = new MicrosoftOAuthMailer(config);
        const token = await mailer.getAccessToken();
        
        if (token) {
            log('✅ Successfully obtained OAuth2 access token!', 'green');
            log(`📄 Token preview: ${token.substring(0, 50)}...`, 'blue');
            return true;
        } else {
            log('❌ Failed to obtain access token', 'red');
            return false;
        }
    } catch (error) {
        log('❌ OAuth2 Token Error:', 'red');
        log(error.message, 'red');
        if (error.response?.data) {
            log('Response details:', 'yellow');
            console.log(JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Function to create sample QR code for testing
function createSampleQRCode() {
    try {
        // Create a simple base64 encoded sample QR code (just for testing)
        const sampleQR = Buffer.from('SAMPLE_QR_CODE_DATA').toString('base64');
        return sampleQR;
    } catch (error) {
        log('⚠️  Could not create sample QR code, proceeding without it', 'yellow');
        return null;
    }
}

// Function to test email sending
async function testEmailSending(recipientEmail) {
    log('\n📧 Testing Email Sending...', 'cyan');
    
    try {
        // Create sample user data
        const userData = {
            name: 'Test User',
            events: ['Cultural Event 1', 'Technical Event 2', 'Management Event 3'],
            qrCodeBase64: createSampleQRCode()
        };
        
        log(`📤 Sending test email to: ${recipientEmail}`, 'blue');
        log(`👤 Test user: ${userData.name}`, 'blue');
        log(`🎭 Test events: ${userData.events.join(', ')}`, 'blue');
        
        const result = await sendRegistrationEmail(recipientEmail, userData);
        
        if (result.success) {
            log('✅ Email sent successfully!', 'green');
            log('📧 Check your inbox for the registration email', 'green');
            return true;
        } else {
            log('❌ Email sending failed:', 'red');
            log(result.error, 'red');
            return false;
        }
    } catch (error) {
        log('❌ Email Test Error:', 'red');
        log(error.message, 'red');
        return false;
    }
}

// Function to test with actual QR code file
async function testWithActualQRCode(recipientEmail) {
    log('\n🔍 Testing with Actual QR Code File...', 'cyan');
    
    try {
        // Look for any existing QR code in the public/qrcodes directory
        const qrDir = path.join(__dirname, 'public', 'qrcodes');
        let qrCodeBase64 = null;
        
        if (fs.existsSync(qrDir)) {
            const files = fs.readdirSync(qrDir).filter(file => file.endsWith('.png'));
            if (files.length > 0) {
                const qrFile = files[0];
                const qrPath = path.join(qrDir, qrFile);
                const qrBuffer = fs.readFileSync(qrPath);
                qrCodeBase64 = qrBuffer.toString('base64');
                log(`📱 Found QR code file: ${qrFile}`, 'green');
            } else {
                log('📱 No QR code files found in public/qrcodes/', 'yellow');
            }
        } else {
            log('📁 QR codes directory not found', 'yellow');
        }
        
        const userData = {
            name: 'Test User with Real QR',
            events: ['Dance Competition', 'Coding Contest', 'Business Plan'],
            qrCodeBase64: qrCodeBase64
        };
        
        const result = await sendRegistrationEmail(recipientEmail, userData);
        
        if (result.success) {
            log('✅ Email with actual QR code sent successfully!', 'green');
            return true;
        } else {
            log('❌ Email sending failed:', 'red');
            log(result.error, 'red');
            return false;
        }
    } catch (error) {
        log('❌ QR Code Test Error:', 'red');
        log(error.message, 'red');
        return false;
    }
}

// Main test function
async function runEmailTests() {
    log('🚀 Starting Sabrang\'25 Email Service Tests...', 'bright');
    log('=' * 50, 'cyan');
    
    // Get recipient email from command line argument or environment variable
    const recipientEmail = process.argv[2] || process.env.TO_EMAIL || process.env.TEST_EMAIL;
    
    if (!recipientEmail) {
        log('❌ No recipient email provided!', 'red');
        log('Usage: node test-email.js <recipient@example.com>', 'yellow');
        log('Or set TO_EMAIL or TEST_EMAIL in your .env file', 'yellow');
        process.exit(1);
    }
    
    log(`📧 Test recipient: ${recipientEmail}`, 'blue');
    
    let testResults = {
        envValidation: false,
        tokenAcquisition: false,
        basicEmailSending: false,
        qrCodeEmailSending: false
    };
    
    try {
        // Test 1: Environment validation
        testResults.envValidation = validateEnvironment();
        if (!testResults.envValidation) {
            log('\n❌ Environment validation failed. Please fix the issues above.', 'red');
            process.exit(1);
        }
        
        // Test 2: OAuth2 token acquisition
        testResults.tokenAcquisition = await testOAuth2Token();
        if (!testResults.tokenAcquisition) {
            log('\n❌ OAuth2 token acquisition failed. Check your Azure app configuration.', 'red');
            process.exit(1);
        }
        
        // Add delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 3: Basic email sending
        testResults.basicEmailSending = await testEmailSending(recipientEmail);
        
        // Add delay between tests
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 4: Email with actual QR code
        testResults.qrCodeEmailSending = await testWithActualQRCode(recipientEmail);
        
    } catch (error) {
        log('\n💥 Unexpected error during testing:', 'red');
        log(error.message, 'red');
        console.error(error);
    }
    
    // Test summary
    log('\n📊 Test Results Summary:', 'bright');
    log('=' * 30, 'cyan');
    
    Object.entries(testResults).forEach(([test, passed]) => {
        const status = passed ? '✅ PASSED' : '❌ FAILED';
        const color = passed ? 'green' : 'red';
        log(`${test}: ${status}`, color);
    });
    
    const allPassed = Object.values(testResults).every(result => result);
    
    if (allPassed) {
        log('\n🎉 All tests passed! Your email service is ready to use.', 'green');
        log('💡 You can now use the admin routes to send emails to users.', 'blue');
    } else {
        log('\n⚠️  Some tests failed. Please check the errors above.', 'yellow');
    }
    
    log('\n📚 Next steps:', 'cyan');
    log('1. If tests passed, your email service is ready', 'blue');
    log('2. Use admin routes to manage user emails', 'blue');
    log('3. Check EMAIL_SETUP.md for detailed configuration', 'blue');
    log('4. Monitor console logs when sending bulk emails', 'blue');
}

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('📧 Sabrang\'25 Email Service Tester', 'bright');
    log('', 'reset');
    log('Usage:', 'cyan');
    log('  node test-email.js <recipient@example.com>', 'blue');
    log('  node test-email.js --help', 'blue');
    log('', 'reset');
    log('Environment Variables Required:', 'cyan');
    log('  CLIENT_ID     - Azure App Client ID', 'blue');
    log('  CLIENT_SECRET - Azure App Client Secret', 'blue');
    log('  TENANT_ID     - Azure Tenant ID', 'blue');
    log('  FROM_EMAIL    - Your organization email', 'blue');
    log('', 'reset');
    log('Optional:', 'cyan');
    log('  TO_EMAIL      - Default test recipient', 'blue');
    log('  TEST_EMAIL    - Alternative test recipient', 'blue');
    process.exit(0);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runEmailTests().catch(error => {
        log('💥 Fatal error:', 'red');
        console.error(error);
        process.exit(1);
    });
}

module.exports = {
    runEmailTests,
    testEmailSending,
    validateEnvironment,
    testOAuth2Token
};
