const { sendRegistrationEmail } = require('./utils/emailService');
const { generateUserQRCode } = require('./utils/qrCodeService');

async function testEmailWithQR() {
  try {
    console.log('🧪 Testing email with QR code attachment...');
    
    // Generate a test QR code
    const testUserId = 'test_user_12345';
    const testUserData = {
      name: 'Test User',
      email: 'suryaanshsharma@jklu.edu.in',
      events: ['Dance Competition', 'Coding Contest']
    };
    
    console.log('🔍 Generating test QR code...');
    const qrCodeBase64 = await generateUserQRCode(testUserId, testUserData);
    console.log(`✅ QR code generated, length: ${qrCodeBase64.length}`);
    
    // Prepare email data with QR code
    const emailData = {
      name: testUserData.name,
      events: testUserData.events,
      qrCodeBase64: qrCodeBase64
    };
    
    console.log('📧 Sending test email with QR attachment...');
    
    // You should change this to your actual test email
    const testEmail = process.env.TEST_EMAIL || 'suryaanshsharma@jklu.edu.in';
    
    const result = await sendRegistrationEmail(testEmail, emailData);
    
    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📎 QR code was attached to the email');
    } else {
      console.error('❌ Test email failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailWithQR();
