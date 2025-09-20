const qr = require('qr-image');

/**
 * Generate QR code as base64 string
 * @param {string} data - The data to encode in the QR code
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} - Base64 encoded QR code image
 */
async function generateQRCodeBase64(data, options = {}) {
  try {
    const defaultOptions = {
      type: 'png',
      size: 10,
      margin: 1
    };
    
    const qrOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const qrPng = qr.image(data, qrOptions);
      const chunks = [];
      
      qrPng.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      qrPng.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(base64);
      });
      
      qrPng.on('error', (error) => {
        console.error('❌ QR code generation failed:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ QR code generation error:', error);
    throw error;
  }
}

/**
 * Generate QR code data for user/team member
 * @param {string} userId - User or team member ID
 * @param {Object} userData - User data object
 * @returns {string} - JSON stringified QR data
 */
function generateQRData(userId, userData) {
  return JSON.stringify({
    id: userId,
    name: userData.name,
    email: userData.email,
    timestamp: Date.now()
  });
}

/**
 * Generate QR code for user/team member and return base64
 * @param {string} userId - User or team member ID
 * @param {Object} userData - User data object
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} - Base64 encoded QR code image
 */
async function generateUserQRCode(userId, userData, options = {}) {
  try {
    const qrData = generateQRData(userId, userData);
    const base64 = await generateQRCodeBase64(qrData, options);
    console.log(`✅ QR code generated as base64 for user: ${userId}`);
    return base64;
  } catch (error) {
    console.error(`❌ Failed to generate QR code for user ${userId}:`, error);
    throw error;
  }
}

module.exports = {
  generateQRCodeBase64,
  generateQRData,
  generateUserQRCode
};
