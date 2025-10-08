/**
 * Script to display details of all orders from the purchases schema
 */

const mongoose = require('mongoose');
const { Purchase, User } = require('./models/models');

async function displayOrderDetails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sabrang');
    console.log('✅ Connected to MongoDB\n');
    
    // Get all purchases with user details
    const purchases = await Purchase.find({})
      .populate('userId', 'name email contactNo')
      .populate('mainPersonId', 'name email contactNo')
      .sort({ purchaseDate: -1 });
    
    if (purchases.length === 0) {
      console.log('📭 No purchases found in the database');
      return;
    }
    
    console.log(`📊 Found ${purchases.length} orders in the database\n`);
    console.log('='.repeat(100));
    
    // Group purchases by status
    const statusGroups = {
      pending: [],
      completed: [],
      failed: [],
      refunded: []
    };
    
    purchases.forEach(purchase => {
      const status = purchase.paymentStatus || 'pending';
      if (statusGroups[status]) {
        statusGroups[status].push(purchase);
      }
    });
    
    // Display summary
    console.log('📈 PAYMENT STATUS SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Completed: ${statusGroups.completed.length}`);
    console.log(`⏳ Pending: ${statusGroups.pending.length}`);
    console.log(`❌ Failed: ${statusGroups.failed.length}`);
    console.log(`🔄 Refunded: ${statusGroups.refunded.length}`);
    console.log('\n' + '='.repeat(100) + '\n');
    
    // Display detailed information for each purchase
    purchases.forEach((purchase, index) => {
      console.log(`🛒 ORDER ${index + 1}:`);
      console.log(`   Order ID: ${purchase.orderId}`);
      console.log(`   Cashfree Order ID: ${purchase.cashfreeOrderId || 'Not set'}`);
      console.log(`   Payment Session ID: ${purchase.paymentSessionId || 'Not set'}`);
      
      // Status with emoji
      const statusEmoji = {
        completed: '✅',
        pending: '⏳',
        failed: '❌',
        refunded: '🔄'
      };
      console.log(`   Status: ${statusEmoji[purchase.paymentStatus] || '❓'} ${purchase.paymentStatus?.toUpperCase() || 'UNKNOWN'}`);
      
      // User information
      const user = purchase.userId || purchase.mainPersonId;
      const userDetails = purchase.userDetails;
      console.log(`   Customer: ${user?.name || userDetails?.name || 'Unknown'}`);
      console.log(`   Email: ${user?.email || userDetails?.email || 'Unknown'}`);
      console.log(`   Contact: ${user?.contactNo || userDetails?.contactNo || 'Unknown'}`);
      
      // Order details
      console.log(`   Total Amount: ₹${purchase.totalAmount}`);
      console.log(`   Items: ${purchase.items?.length || 0} item(s)`);
      
      // Display items
      if (purchase.items && purchase.items.length > 0) {
        purchase.items.forEach((item, itemIndex) => {
          console.log(`     ${itemIndex + 1}. ${item.itemName || item.itemId} - ₹${item.price}`);
        });
      }
      
      // Timestamps
      console.log(`   Order Date: ${purchase.purchaseDate?.toLocaleString() || 'Unknown'}`);
      if (purchase.paymentCompletedAt) {
        console.log(`   Payment Completed: ${purchase.paymentCompletedAt.toLocaleString()}`);
      }
      
      // Processing status
      console.log(`   User Registered: ${purchase.userRegistered ? '✅' : '❌'}`);
      console.log(`   QR Generated: ${purchase.qrGenerated ? '✅' : '❌'}`);
      console.log(`   Email Sent: ${purchase.emailSent ? '✅' : '❌'}`);
      
      // Payment method and transaction
      if (purchase.paymentMethod) {
        console.log(`   Payment Method: ${purchase.paymentMethod}`);
      }
      if (purchase.transactionId) {
        console.log(`   Transaction ID: ${purchase.transactionId}`);
      }
      
      // Promo code
      if (purchase.promoCode && purchase.promoCode.code) {
        console.log(`   Promo Code: ${purchase.promoCode.code} (₹${purchase.promoCode.discountAmount} discount)`);
      }
      
      console.log(`   ${'-'.repeat(80)}\n`);
    });
    
    // Additional statistics
    console.log('📊 ADDITIONAL STATISTICS');
    console.log('='.repeat(50));
    
    const totalRevenue = purchases
      .filter(p => p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    const pendingRevenue = purchases
      .filter(p => p.paymentStatus === 'pending')
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    console.log(`💰 Total Revenue (Completed): ₹${totalRevenue}`);
    console.log(`⏳ Pending Revenue: ₹${pendingRevenue}`);
    
    const averageOrderValue = purchases.length > 0 ? 
      (purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0) / purchases.length).toFixed(2) : 0;
    console.log(`📈 Average Order Value: ₹${averageOrderValue}`);
    
    // QR Code generation status
    const missingQR = purchases.filter(p => p.paymentStatus === 'completed' && !p.qrGenerated);
    const missingEmail = purchases.filter(p => p.paymentStatus === 'completed' && !p.emailSent);
    
    console.log(`🎫 Orders missing QR codes: ${missingQR.length}`);
    console.log(`📧 Orders missing confirmation emails: ${missingEmail.length}`);
    
    if (missingQR.length > 0) {
      console.log('\n⚠️  ORDERS MISSING QR CODES:');
      missingQR.forEach(order => {
        console.log(`   - ${order.orderId} (${order.userDetails?.name || 'Unknown'})`);
      });
    }
    
    if (missingEmail.length > 0) {
      console.log('\n⚠️  ORDERS MISSING CONFIRMATION EMAILS:');
      missingEmail.forEach(order => {
        console.log(`   - ${order.orderId} (${order.userDetails?.name || 'Unknown'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error displaying order details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

// Load environment variables
require('dotenv').config();

// Run the script
displayOrderDetails();