#!/usr/bin/env node

// Debug script to check payment status for a specific user
require("dotenv").config();
const mongoose = require("mongoose");
const { User, Purchase } = require("./models/models");

async function debugPaymentStatus(email) {
  try {
    // Connect to database
    await mongoose.connect(process.env.mongodb);
    console.log("✅ Connected to database");

    // Find user
    const user = await User.findOne({ email: email });
    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("👤 User found:");
    console.log(`  - ID: ${user._id}`);
    console.log(`  - Name: ${user.name}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Events: ${user.events}`);
    console.log(`  - Has QR Code: ${!!user.qrCodeBase64}`);
    console.log(`  - Referral Code: ${user.referralCode || 'Not set'}`);

    // Check if user has paymentStatus field (shouldn't exist)
    if (user.paymentStatus !== undefined) {
      console.log(`⚠️  User has incorrect paymentStatus field: ${user.paymentStatus}`);
      console.log("   This field should not exist on User model");
    }

    // Find purchases for this user
    const purchases = await Purchase.find({
      $or: [
        { userId: user._id },
        { mainPersonId: user._id },
        { 'userDetails.email': email }
      ]
    });

    console.log(`\n💰 Found ${purchases.length} purchase(s):`);
    for (const purchase of purchases) {
      console.log(`  - Order ID: ${purchase.orderId}`);
      console.log(`  - Payment Status: ${purchase.paymentStatus}`);
      console.log(`  - QR Generated: ${purchase.qrGenerated}`);
      console.log(`  - Amount: ${purchase.totalAmount}`);
      console.log(`  - Purchase Date: ${purchase.purchaseDate}`);
      if (purchase.paymentCompletedAt) {
        console.log(`  - Payment Completed At: ${purchase.paymentCompletedAt}`);
      }
      console.log(`  ---`);
    }

    // Check completed purchases
    const completedPurchases = purchases.filter(p => p.paymentStatus === 'completed');
    console.log(`\n✅ Completed purchases: ${completedPurchases.length}`);

    if (completedPurchases.length === 0 && purchases.length > 0) {
      console.log("\n🔧 ISSUE FOUND: User has purchases but none are completed");
      console.log("   This means QR codes won't be accessible");
      console.log("\n💡 To fix this, you need to:");
      console.log("   1. Verify the payment with Cashfree");
      console.log("   2. Call the /success/:orderId endpoint for each order");
      
      for (const purchase of purchases) {
        console.log(`   curl http://localhost:5000/api/payments/success/${purchase.orderId}`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.log("Usage: node debug-payment-status.js <email>");
  console.log("Example: node debug-payment-status.js suryaanshsharma@jklu.edu.in");
  process.exit(1);
}

debugPaymentStatus(email);
