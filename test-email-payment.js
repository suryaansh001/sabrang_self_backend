require('dotenv').config();
const emailService = require('./utils/emailService');

// ANSI color codes for better console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test payment initiation email
async function testPaymentEmail() {
    log('🧪 Testing Payment Initiation Email...', 'bright');
    
    // Get recipient email from command line or environment
    const recipientEmail = process.argv[2] || process.env.TO_EMAIL || process.env.TEST_EMAIL;
    
    if (!recipientEmail) {
        log('❌ No recipient email provided!', 'red');
        log('Usage: node test-email-payment.js <recipient@example.com>', 'yellow');
        log('Or set TO_EMAIL or TEST_EMAIL in your .env file', 'yellow');
        process.exit(1);
    }
    
    // Check environment variables
    log('\n📧 Email Configuration:', 'cyan');
    log('CLIENT_ID: ' + (process.env.CLIENT_ID ? 'Set ✅' : 'Missing ❌'), process.env.CLIENT_ID ? 'green' : 'red');
    log('CLIENT_SECRET: ' + (process.env.CLIENT_SECRET ? 'Set ✅' : 'Missing ❌'), process.env.CLIENT_SECRET ? 'green' : 'red');
    log('TENANT_ID: ' + (process.env.TENANT_ID ? 'Set ✅' : 'Missing ❌'), process.env.TENANT_ID ? 'green' : 'red');
    log('FROM_EMAIL: ' + (process.env.FROM_EMAIL ? 'Set ✅' : 'Missing ❌'), process.env.FROM_EMAIL ? 'green' : 'red');
    
    if (!process.env.FROM_EMAIL) {
        log('❌ FROM_EMAIL is missing. Please add it to .env file', 'red');
        log('Example: FROM_EMAIL=sabrang@jklu.edu.in', 'yellow');
        return;
    }
    
    const testPaymentData = {
        email: recipientEmail,
        name: 'Test User for Payment',
        orderId: 'order_test_' + Date.now(),
        amount: '1',
        paymentSessionId: 'session_test_' + Math.random().toString(36).substring(2, 15),
        environment: 'production'
    };
    
    log(`\n📧 Sending payment email to: ${recipientEmail}`, 'blue');
    log(`👤 User: ${testPaymentData.name}`, 'blue');
    log(`💳 Order ID: ${testPaymentData.orderId}`, 'blue');
    log(`💰 Amount: ₹${testPaymentData.amount}`, 'blue');
    log(`🌍 Environment: ${testPaymentData.environment}`, 'blue');
    
    try {
        log('\n🚀 Sending test payment email...', 'cyan');
        const result = await emailService.sendPaymentInitiatedEmail(testPaymentData);
        
        if (result.success) {
            log('✅ Payment email sent successfully!', 'green');
            log('📧 Check your inbox for the payment initiation email', 'green');
            log('📊 Result details:', 'blue');
            console.log(JSON.stringify(result, null, 2));
        } else {
            log('❌ Payment email failed:', 'red');
            log('Error details: ' + result.error, 'red');
        }
    } catch (error) {
        log('💥 Error testing payment email:', 'red');
        log('Message: ' + error.message, 'red');
        console.error('Stack:', error.stack);
    }
}

// Run the test
testPaymentEmail().then(() => {
    console.log('\n✨ Email test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});
