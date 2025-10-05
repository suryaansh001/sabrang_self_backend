#!/usr/bin/env node

/**
 * Fix Himani Saraf Script
 * Quick script to fix Himani's registration and send QR code
 */

const mongoose = require('mongoose');
const { User, Purchase } = require('./models/models');
const { generateUserQRCode } = require('./utils/qrCodeService');
const { sendRegistrationEmail } = require('./utils/emailService');
require('dotenv').config();

async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.mongodburl || 'mongodb://localhost:27017/sabrang';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function fixHimaniRegistration() {
    try {
        console.log('🔧 Fixing Himani Saraf registration...\n');
        
        // Find Himani by email
        const email = 'himanisaraf7@gmail.com';
        let user = await User.findOne({ email: email });
        
        if (!user) {
            console.log('❌ User not found with email:', email);
            return;
        }
        
        console.log('📋 Current User Status:');
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Events: [${user.events.join(', ')}]`);
        console.log(`Validated: ${user.isvalidated}`);
        console.log(`QR Path: ${user.qrPath || 'None'}`);
        console.log(`Email Sent: ${user.emailSent || false}\n`);
        
        // Check her purchases
        const purchases = await Purchase.find({
            $or: [
                { 'userDetails.email': email },
                { 'customerDetails.email': email }
            ]
        }).sort({ createdAt: -1 });
        
        console.log('💳 Found Purchases:');
        purchases.forEach(purchase => {
            console.log(`- Order: ${purchase.orderId}, Status: ${purchase.paymentStatus || purchase.status}, Amount: ₹${purchase.amount || purchase.totalAmount}`);
        });
        
        // If events array is empty, add BGMI based on her order
        if (user.events.length === 0) {
            console.log('\n🎮 Adding BGMI TOURNAMENT event...');
            user.events.push('BGMI TOURNAMENT');
        }
        
        // Generate QR code if not exists
        if (!user.qrCodeBase64) {
            console.log('🏗️ Generating QR code...');
            const qrCodeBase64 = await generateUserQRCode(user._id, {
                name: user.name,
                email: user.email,
                events: user.events,
                userId: user._id
            });
            
            if (qrCodeBase64) {
                user.qrPath = `qr_${user._id}.png`; // Set a virtual path
                user.qrCodeBase64 = qrCodeBase64;
                console.log('✅ QR code generated successfully!');
            } else {
                console.log('❌ QR code generation failed: No QR code returned');
                return;
            }
        }
        
        // Set as validated
        user.isvalidated = true;
        user.updatedAt = new Date();
        
        // Save user
        await user.save();
        console.log('✅ User updated successfully!');
        
        // Send registration email
        console.log('📧 Sending registration email...');
        const emailData = {
            name: user.name,
            events: user.events,
            qrCodeBase64: user.qrCodeBase64
        };
        
        const emailResult = await sendRegistrationEmail(user.email, emailData);
        
        if (emailResult.success) {
            user.emailSent = true;
            user.emailSentAt = new Date();
            await user.save();
            console.log('✅ Registration email sent successfully!');
        } else {
            console.log('❌ Email sending failed:', emailResult.error);
        }
        
        console.log('\n🎉 Himani Saraf registration fixed successfully!');
        console.log(`📱 QR Code Path: ${user.qrPath}`);
        console.log(`📧 Email sent to: ${user.email}`);
        
    } catch (error) {
        console.error('❌ Error fixing registration:', error.message);
    }
}

async function main() {
    console.log('🎯 Fix Himani Saraf Registration');
    console.log('=================================\n');
    
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    try {
        await fixHimaniRegistration();
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        console.log('✅ Script completed!');
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}

module.exports = { fixHimaniRegistration };