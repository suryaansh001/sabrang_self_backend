// Test referral code processing
const testReferral = (input) => {
  // Simulate the frontend processing
  let value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  console.log(`Input: "${input}" -> Output: "${value}"`);
  return value;
};

console.log("Testing referral code processing:");
testReferral("abc123");      // Should be "ABC123"
testReferral("test@123");    // Should be "TEST123"
testReferral("referral_1");  // Should be "REFERRAL1"
testReferral("XYZ789");      // Should be "XYZ789"
testReferral("hello world"); // Should be "HELLOWORLD"
