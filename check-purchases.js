const mongoose = require('mongoose');
require('dotenv').config();

const { User, TeamComposition, Purchase } = require('./models/models');

async function checkPurchaseRecords() {
  try {
    await mongoose.connect(process.env.mongodb);
    console.log('Connected to MongoDB');

    // Find purchases for Suryaansh
    console.log('=== PURCHASE RECORDS FOR SURYAANSH ===');
    const suryaanshPurchases = await Purchase.find({
      $or: [
        { 'userDetails.email': 'suryaanshsharma@jklu.edu.in' },
        { 'userDetails.email': 'suryaanshsharma@jklu.edu.in'.toLowerCase() }
      ]
    }).sort({ purchaseDate: -1 });

    console.log(`Found ${suryaanshPurchases.length} purchase records:`);
    
    suryaanshPurchases.forEach((purchase, index) => {
      console.log(`\n--- Purchase ${index + 1} ---`);
      console.log(`Order ID: ${purchase.orderId}`);
      console.log(`User Name: ${purchase.userDetails.name}`);
      console.log(`Email: ${purchase.userDetails.email}`);
      console.log(`Payment Status: ${purchase.paymentStatus}`);
      console.log(`Total Amount: ₹${purchase.totalAmount}`);
      console.log(`Purchase Date: ${purchase.purchaseDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`User Registered: ${purchase.userRegistered}`);
      console.log(`QR Generated: ${purchase.qrGenerated}`);
      console.log(`Email Sent: ${purchase.emailSent}`);
      
      if (purchase.items && purchase.items.length > 0) {
        console.log(`Items:`);
        purchase.items.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.itemName} - ₹${item.price} (${item.type})`);
        });
      }
      
      if (purchase.userDetails.teamMembers && purchase.userDetails.teamMembers.length > 0) {
        console.log(`Team Members:`);
        purchase.userDetails.teamMembers.forEach((member, i) => {
          console.log(`  ${i + 1}. ${member.name} (${member.email})`);
        });
      }

      if (purchase.promoCode && purchase.promoCode.code) {
        console.log(`Promo Code: ${purchase.promoCode.code} - Discount: ₹${purchase.promoCode.discountAmount}`);
      }
    });

    // Find all recent purchases
    console.log('\n\n=== ALL RECENT PURCHASES (Last 48 hours) ===');
    const recentPurchases = await Purchase.find({
      purchaseDate: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
    }).sort({ purchaseDate: -1 });

    console.log(`Found ${recentPurchases.length} recent purchases:`);
    recentPurchases.forEach((purchase, index) => {
      console.log(`${index + 1}. ${purchase.userDetails.name} (${purchase.userDetails.email}) - ₹${purchase.totalAmount} - ${purchase.paymentStatus} - ${purchase.purchaseDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });

    // Find completed purchases
    console.log('\n\n=== COMPLETED PURCHASES ===');
    const completedPurchases = await Purchase.find({
      paymentStatus: 'completed'
    }).sort({ purchaseDate: -1 }).limit(10);

    console.log(`Found ${completedPurchases.length} completed purchases:`);
    completedPurchases.forEach((purchase, index) => {
      console.log(`${index + 1}. ${purchase.userDetails.name} (${purchase.userDetails.email}) - Order: ${purchase.orderId} - ₹${purchase.totalAmount} - ${purchase.purchaseDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
  }
}

checkPurchaseRecords();
