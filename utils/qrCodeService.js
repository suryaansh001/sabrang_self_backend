const qr = require('qr-image');

/**
 * Generate QR code as base64 string
 * @param {string} data - The data to encode in the QR code
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} - Base64 encoded QR code image
 */
async function generateQRCodeBase64(data, options = {}) {
  try {
    // Validate and sanitize input data
    if (!data) {
      console.log('⚠️ No data provided, using fallback');
      data = `fallback_${Date.now()}`;
    }
    
    if (typeof data !== 'string') {
      console.log('⚠️ Data is not string, converting:', typeof data);
      data = String(data);
    }
    
    if (data.length === 0) {
      console.log('⚠️ Empty data, using timestamp fallback');
      data = `empty_${Date.now()}`;
    }
    
    // Ensure data is not too long for QR code
    if (data.length > 2000) {
      console.log('⚠️ Data too long, truncating');
      data = data.substring(0, 2000);
    }
    
    console.log(`🔍 Generating QR code with data: "${data}" (length: ${data.length})`);
    
    const defaultOptions = {
      type: 'png',
      size: 10,
      margin: 1,
      ec_level: 'M' // Medium error correction
    };
    
    const qrOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      try {
        const qrPng = qr.image(data, qrOptions);
        const chunks = [];
        
        // Set timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error('❌ QR generation timeout after 10 seconds');
          reject(new Error('QR code generation timeout'));
        }, 10000);
        
        qrPng.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        qrPng.on('end', () => {
          clearTimeout(timeout);
          try {
            const buffer = Buffer.concat(chunks);
            if (buffer.length === 0) {
              console.error('❌ Empty buffer generated');
              reject(new Error('Empty QR code buffer'));
              return;
            }
            
            const base64 = buffer.toString('base64');
            if (!base64 || base64.length === 0) {
              console.error('❌ Empty base64 generated');
              reject(new Error('Empty base64 string'));
              return;
            }
            
            console.log(`✅ QR code generated successfully, base64 length: ${base64.length}`);
            resolve(base64);
          } catch (bufferError) {
            clearTimeout(timeout);
            console.error('❌ Error processing buffer:', bufferError);
            reject(bufferError);
          }
        });
        
        qrPng.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ QR code generation failed:', error);
          reject(error);
        });
      } catch (qrError) {
        console.error('❌ Error creating QR image:', qrError);
        reject(qrError);
      }
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
 * @returns {string} - Simple ID string
 */
function generateQRData(userId, userData) {
  // Validate and clean the user ID
  if (!userId) {
    // Generate fallback ID if userId is missing
    const fallbackId = userData?.email || `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log(`⚠️ No userId provided, using fallback: ${fallbackId}`);
    return String(fallbackId).trim();
  }
  
  // Convert to string and clean any invalid characters
  const cleanId = String(userId).trim();
  
  if (!cleanId) {
    // Generate fallback if cleanId is empty
    const fallbackId = userData?.email || `empty_fallback_${Date.now()}`;
    console.log(`⚠️ UserId is empty after cleaning, using fallback: ${fallbackId}`);
    return fallbackId;
  }
  
  console.log(`🔍 Cleaned user ID for QR: ${cleanId}`);
  return cleanId;
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
    console.log(`🔍 QR data to encode: ${qrData}`);
    const base64 = await generateQRCodeBase64(qrData, options);
    console.log(`✅ QR code generated as base64 for user: ${userId}, base64 length: ${base64 ? base64.length : 'null'}`);
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
