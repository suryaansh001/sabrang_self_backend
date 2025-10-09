/**
 * Find order IDs and payment details for specific BAND JAM users
 */

const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');

async function findBandJamPayments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB');
    
    console.log('💰 FINDING BAND JAM USER PAYMENTS');
    console.log('=' .repeat(80));
    
    // List of BAND JAM users to check
    const bandJamUserEmails = [
      'raghasharma2025@jklu.edu.in',
      'dishikasharma@jklu.edu.in',
      'arnavsharma@jklu.edu.in',
      'pratigyabomb@jklu.edu.in',
      'pathakmayank522@gmail.com',
      'jainjheel1406@gmail.com',
      'asthabarnwal@jklu.edu.in'
    ];
    
    console.log(`📧 Checking payments for ${bandJamUserEmails.length} users...\n`);
    
    // Get all purchases
    const allPurchases = await Purchase.find({}).lean();
    console.log(`💳 Total purchases in database: ${allPurchases.length}`);
    
    // Create email to purchases mapping
    const emailToPurchasesMap = new Map();
    
    for (const purchase of allPurchases) {
      if (purchase.userEmail) {
        const email = purchase.userEmail.toLowerCase();
        if (!emailToPurchasesMap.has(email)) {
          emailToPurchasesMap.set(email, []);
        }
        emailToPurchasesMap.get(email).push(purchase);
      }
    }
    
    console.log(`📧 Unique emails with purchases: ${emailToPurchasesMap.size}\n`);
    
    // Check each BAND JAM user
    let usersWithPayments = 0;
    let usersWithoutPayments = 0;
    let totalOrdersFound = 0;
    
    for (let i = 0; i < bandJamUserEmails.length; i++) {
      const email = bandJamUserEmails[i].toLowerCase();
      
      console.log(`${i + 1}/${bandJamUserEmails.length}. Checking: ${email}`);
      console.log('-' .repeat(60));
      
      // Get user details
      const user = await User.findOne({ email: email }).select('name email events createdAt');
      
      if (!user) {
        console.log(`❌ User not found in database`);
        continue;
      }
      
      console.log(`👤 User: ${user.name}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`🎯 Events: ${user.events ? user.events.join(', ') : 'None'}`);
      console.log(`📅 Registered: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}`);
      
      // Find purchases for this user
      const userPurchases = emailToPurchasesMap.get(email) || [];
      
      if (userPurchases.length === 0) {
        console.log(`❌ No purchases found for this user`);
        usersWithoutPayments++;
      } else {
        console.log(`💰 Found ${userPurchases.length} purchase(s):`);
        usersWithPayments++;
        totalOrdersFound += userPurchases.length;
        
        userPurchases.forEach((purchase, idx) => {
          console.log(`\n   Order ${idx + 1}:`);
          console.log(`   🆔 Order ID: ${purchase.orderId || 'N/A'}`);
          console.log(`   💳 Payment Status: ${purchase.paymentStatus || 'Unknown'}`);
          console.log(`   💰 Amount: ₹${purchase.amount || 'N/A'}`);
          console.log(`   📅 Date: ${purchase.createdAt ? new Date(purchase.createdAt).toLocaleString() : 'Unknown'}`);
          console.log(`   🏷️  Event: ${purchase.eventName || 'N/A'}`);
          console.log(`   📧 Email: ${purchase.userEmail || 'N/A'}`);
          console.log(`   📱 Phone: ${purchase.contactNumber || 'N/A'}`);
          
          // Check if payment is successful
          const isSuccessful = purchase.paymentStatus && (
            purchase.paymentStatus.toLowerCase() === 'completed' ||
            purchase.paymentStatus.toLowerCase() === 'paid' ||
            purchase.paymentStatus.toLowerCase() === 'success'
          );
          
          console.log(`   ✅ Payment Successful: ${isSuccessful ? 'Yes' : 'No'}`);
          
          if (purchase.paymentId) {
            console.log(`   🏦 Payment ID: ${purchase.paymentId}`);
          }
          
          if (purchase.signature) {
            console.log(`   🔏 Signature: ${purchase.signature.substring(0, 20)}...`);
          }
        });
      }
      
      console.log('\n');
    }
    
    // Summary
    console.log('📊 PAYMENT SEARCH SUMMARY');
    console.log('=' .repeat(80));
    console.log(`👥 Total users checked: ${bandJamUserEmails.length}`);
    console.log(`💰 Users with payments: ${usersWithPayments}`);
    console.log(`❌ Users without payments: ${usersWithoutPayments}`);
    console.log(`🆔 Total orders found: ${totalOrdersFound}`);
    
    // Show successful payments only
    console.log('\n✅ SUCCESSFUL PAYMENTS ONLY:');
    console.log('-' .repeat(60));
    
    let successfulPayments = 0;
    
    for (const email of bandJamUserEmails) {
      const userPurchases = emailToPurchasesMap.get(email.toLowerCase()) || [];
      const successfulUserPurchases = userPurchases.filter(purchase => 
        purchase.paymentStatus && (
          purchase.paymentStatus.toLowerCase() === 'completed' ||
          purchase.paymentStatus.toLowerCase() === 'paid' ||
          purchase.paymentStatus.toLowerCase() === 'success'
        )
      );
      
      if (successfulUserPurchases.length > 0) {
        const user = await User.findOne({ email: email.toLowerCase() }).select('name');
        console.log(`\n💰 ${user ? user.name : 'Unknown'} (${email}):`);
        
        successfulUserPurchases.forEach((purchase, idx) => {
          console.log(`   ${idx + 1}. Order ID: ${purchase.orderId} | Amount: ₹${purchase.amount} | Status: ${purchase.paymentStatus}`);
          successfulPayments++;
        });
      }
    }
    
    console.log(`\n✅ Total successful payments: ${successfulPayments}`);
    
    // Create CSV of findings
    console.log('\n📄 CREATING PAYMENT DETAILS CSV...');
    console.log('-' .repeat(60));
    
    const csvHeaders = [
      'Name',
      'Email',
      'Events',
      'Has Payment',
      'Order IDs',
      'Payment Status',
      'Amount',
      'Payment Date',
      'Registration Date'
    ];
    
    const csvRows = [];
    
    for (const email of bandJamUserEmails) {
      const user = await User.findOne({ email: email.toLowerCase() }).select('name email events createdAt');
      const userPurchases = emailToPurchasesMap.get(email.toLowerCase()) || [];
      
      if (userPurchases.length === 0) {
        csvRows.push([
          user ? user.name : 'Unknown',
          email,
          user && user.events ? user.events.join('; ') : '',
          'No',
          '',
          '',
          '',
          '',
          user && user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
        ]);
      } else {
        userPurchases.forEach(purchase => {
          csvRows.push([
            user ? user.name : 'Unknown',
            email,
            user && user.events ? user.events.join('; ') : '',
            'Yes',
            purchase.orderId || '',
            purchase.paymentStatus || '',
            purchase.amount || '',
            purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString() : '',
            user && user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
          ]);
        });
      }
    }
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => {
          const fieldStr = String(field || '');
          if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }
          return fieldStr;
        }).join(',')
      )
    ].join('\n');
    
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `bandjam_payment_details_${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    console.log(`✅ CSV file created: ${filename}`);
    console.log(`📁 File path: ${filepath}`);
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    console.log('\n💰 BAND JAM PAYMENT SEARCH COMPLETED!');
    
    return {
      totalChecked: bandJamUserEmails.length,
      usersWithPayments,
      usersWithoutPayments,
      totalOrdersFound,
      successfulPayments,
      csvFile: filename
    };
    
  } catch (error) {
    console.error('❌ Error finding BAND JAM payments:', error);
    return null;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Export for use by other scripts
module.exports = { findBandJamPayments };

// Run the script if called directly
if (require.main === module) {
  findBandJamPayments();
}