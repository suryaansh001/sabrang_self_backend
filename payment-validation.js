/**
 * Payment Validation Strategy and Implementation Guide
 * 
 * This document outlines how to prevent unpaid users from accessing the system
 * and provides middleware and validation methods to ensure payment verification.
 */

const mongoose = require('mongoose');
const { Purchase, User } = require('./models/models');

/**
 * Middleware to verify payment status before allowing access
 * Use this middleware on protected routes that require payment verification
 */
async function verifyPaymentStatus(req, res, next) {
    try {
        const userId = req.user?._id || req.user?.id;
        const userEmail = req.user?.email;
        
        if (!userId && !userEmail) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'AUTHENTICATION_REQUIRED'
            });
        }
        
        // Check if user has any completed payments
        const hasCompletedPayment = await verifyUserHasCompletedPayment(userId, userEmail);
        
        if (!hasCompletedPayment.success) {
            return res.status(403).json({
                success: false,
                message: 'Payment verification failed. Please complete your payment to access this feature.',
                error: 'PAYMENT_REQUIRED',
                details: hasCompletedPayment.details
            });
        }
        
        // Add payment info to request for downstream use
        req.paymentVerified = true;
        req.paymentDetails = hasCompletedPayment.paymentDetails;
        
        next();
    } catch (error) {
        console.error('Payment verification middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification error',
            error: 'VERIFICATION_ERROR'
        });
    }
}

/**
 * Verify if a user has completed payment for their registration
 */
async function verifyUserHasCompletedPayment(userId, userEmail) {
    try {
        // Build query to find user's purchases
        const query = {
            $or: []
        };
        
        if (userId) {
            query.$or.push(
                { userId: userId },
                { mainPersonId: userId }
            );
        }
        
        if (userEmail) {
            query.$or.push(
                { 'userDetails.email': userEmail.toLowerCase().trim() }
            );
        }
        
        if (query.$or.length === 0) {
            return {
                success: false,
                reason: 'NO_USER_IDENTIFIER',
                details: 'No user ID or email provided for verification'
            };
        }
        
        // Find all purchases for this user
        const purchases = await Purchase.find(query).sort({ purchaseDate: -1 });
        
        if (purchases.length === 0) {
            return {
                success: false,
                reason: 'NO_ORDERS_FOUND',
                details: 'No orders found for this user'
            };
        }
        
        // Check for completed payments
        const completedPurchases = purchases.filter(p => p.paymentStatus === 'completed');
        
        if (completedPurchases.length === 0) {
            // All orders are unpaid
            const pendingOrders = purchases.map(p => ({
                orderId: p.orderId,
                amount: p.totalAmount,
                status: p.paymentStatus || 'pending',
                date: p.purchaseDate
            }));
            
            return {
                success: false,
                reason: 'NO_COMPLETED_PAYMENTS',
                details: 'All orders are pending payment',
                pendingOrders
            };
        }
        
        // User has at least one completed payment
        const paymentDetails = {
            totalOrders: purchases.length,
            completedOrders: completedPurchases.length,
            pendingOrders: purchases.length - completedPurchases.length,
            lastCompletedPayment: completedPurchases[0],
            totalPaidAmount: completedPurchases.reduce((sum, p) => sum + p.totalAmount, 0)
        };
        
        return {
            success: true,
            paymentDetails
        };
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        return {
            success: false,
            reason: 'VERIFICATION_ERROR',
            details: 'Database error during payment verification'
        };
    }
}

/**
 * Check if user should have access to specific features
 */
async function checkFeatureAccess(userId, userEmail, featureType) {
    const paymentVerification = await verifyUserHasCompletedPayment(userId, userEmail);
    
    if (!paymentVerification.success) {
        return {
            hasAccess: false,
            reason: paymentVerification.reason,
            message: getAccessDeniedMessage(featureType, paymentVerification.reason)
        };
    }
    
    // Additional checks based on feature type
    switch (featureType) {
        case 'QR_CODE':
            // User needs completed payment to access QR code
            return {
                hasAccess: true,
                message: 'QR code access granted'
            };
            
        case 'EVENT_ENTRY':
            // User needs completed payment and QR code
            const user = await User.findOne({
                $or: [
                    { _id: userId },
                    { email: userEmail }
                ]
            });
            
            if (!user || (!user.qrPath && !user.qrCodeBase64)) {
                return {
                    hasAccess: false,
                    reason: 'NO_QR_CODE',
                    message: 'QR code required for event entry'
                };
            }
            
            return {
                hasAccess: true,
                message: 'Event entry access granted'
            };
            
        case 'USER_DASHBOARD':
            // User needs completed payment
            return {
                hasAccess: true,
                message: 'Dashboard access granted'
            };
            
        default:
            return {
                hasAccess: true,
                message: 'Feature access granted'
            };
    }
}

/**
 * Get appropriate error message based on access denial reason
 */
function getAccessDeniedMessage(featureType, reason) {
    const baseMessages = {
        'NO_ORDERS_FOUND': 'No registration found. Please register for events first.',
        'NO_COMPLETED_PAYMENTS': 'Payment required. Please complete your payment to access this feature.',
        'NO_QR_CODE': 'QR code not available. Please complete payment first.',
        'VERIFICATION_ERROR': 'Unable to verify payment status. Please try again later.'
    };
    
    const featureSpecificMessages = {
        'QR_CODE': {
            'NO_COMPLETED_PAYMENTS': 'QR code is only available after successful payment. Please complete your payment first.'
        },
        'EVENT_ENTRY': {
            'NO_COMPLETED_PAYMENTS': 'Event entry requires completed payment. Please pay for your registration first.',
            'NO_QR_CODE': 'QR code is required for event entry. Please complete payment to get your QR code.'
        },
        'USER_DASHBOARD': {
            'NO_COMPLETED_PAYMENTS': 'Dashboard access requires completed payment. Please complete your registration payment.'
        }
    };
    
    return featureSpecificMessages[featureType]?.[reason] || baseMessages[reason] || 'Access denied due to payment verification failure.';
}

/**
 * Validate user registration status and payment
 * Use this before allowing user registration to be marked as complete
 */
async function validateUserRegistration(userId, userEmail) {
    try {
        const paymentVerification = await verifyUserHasCompletedPayment(userId, userEmail);
        
        if (!paymentVerification.success) {
            return {
                isValid: false,
                shouldCreateUser: false,
                shouldGenerateQR: false,
                shouldSendEmail: false,
                reason: paymentVerification.reason,
                message: 'Registration cannot be completed without payment verification'
            };
        }
        
        return {
            isValid: true,
            shouldCreateUser: true,
            shouldGenerateQR: true,  // Only generate QR after payment
            shouldSendEmail: true,   // Only send email after payment
            paymentDetails: paymentVerification.paymentDetails,
            message: 'Registration validation successful'
        };
        
    } catch (error) {
        console.error('Error validating registration:', error);
        return {
            isValid: false,
            shouldCreateUser: false,
            shouldGenerateQR: false,
            shouldSendEmail: false,
            reason: 'VALIDATION_ERROR',
            message: 'Error during registration validation'
        };
    }
}

/**
 * Clean up invalid users (users marked as validated but without completed payments)
 * Run this periodically to maintain data integrity
 */
async function cleanupInvalidUsers(dryRun = true) {
    try {
        console.log('🔍 Scanning for users with invalid validation status...');
        
        // Find all validated users
        const validatedUsers = await User.find({ isvalidated: true });
        console.log(`📊 Found ${validatedUsers.length} validated users`);
        
        const invalidUsers = [];
        
        for (const user of validatedUsers) {
            const paymentVerification = await verifyUserHasCompletedPayment(user._id, user.email);
            
            if (!paymentVerification.success) {
                invalidUsers.push({
                    user,
                    reason: paymentVerification.reason,
                    details: paymentVerification.details
                });
            }
        }
        
        console.log(`⚠️ Found ${invalidUsers.length} users with invalid validation status`);
        
        if (invalidUsers.length === 0) {
            console.log('✅ No cleanup needed - all validated users have completed payments');
            return { cleaned: 0, users: [] };
        }
        
        console.log('\n📋 Users that should be cleaned up:');
        invalidUsers.forEach((item, index) => {
            console.log(`${index + 1}. ${item.user.name} (${item.user.email})`);
            console.log(`   Reason: ${item.reason}`);
            console.log(`   Details: ${item.details}`);
        });
        
        if (dryRun) {
            console.log('\n🔒 DRY RUN MODE - No changes made');
            console.log('Set dryRun=false to actually clean up these users');
            return { cleaned: 0, users: invalidUsers };
        }
        
        // Actually clean up users
        console.log('\n🧹 Cleaning up invalid users...');
        let cleanedCount = 0;
        
        for (const item of invalidUsers) {
            try {
                await User.findByIdAndUpdate(item.user._id, {
                    isvalidated: false,
                    qrPath: null,
                    qrCodeBase64: null,
                    emailSent: false
                });
                
                console.log(`✅ Cleaned up: ${item.user.name} (${item.user.email})`);
                cleanedCount++;
            } catch (updateError) {
                console.error(`❌ Error cleaning up ${item.user.email}:`, updateError);
            }
        }
        
        console.log(`\n🎉 Cleanup completed: ${cleanedCount}/${invalidUsers.length} users cleaned`);
        
        return { cleaned: cleanedCount, users: invalidUsers };
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        return { cleaned: 0, users: [], error: error.message };
    }
}

/**
 * Implementation recommendations for your system
 */
function getImplementationGuide() {
    return {
        middlewareUsage: {
            description: "Add payment verification middleware to protected routes",
            example: `
// In your routes file
const { verifyPaymentStatus } = require('./payment-validation');

// Protect QR code routes
app.get('/api/qrcode/:id', verifyPaymentStatus, (req, res) => {
    // QR code logic here - only executed if payment is verified
});

// Protect user dashboard
app.get('/api/user/dashboard', verifyPaymentStatus, (req, res) => {
    // Dashboard logic here
});

// Protect event entry
app.post('/api/entry/verify', verifyPaymentStatus, (req, res) => {
    // Entry verification logic
});
            `
        },
        
        registrationProcess: {
            description: "Update registration process to verify payment before completion",
            example: `
// In your registration endpoint
const { validateUserRegistration } = require('./payment-validation');

app.post('/register', async (req, res) => {
    // ... collect user data ...
    
    // IMPORTANT: Don't create user or generate QR until payment is verified
    // Store order data in Purchase collection with pending status
    
    const purchase = new Purchase({
        orderId: generateOrderId(),
        userDetails: userData,
        items: selectedEvents,
        totalAmount: calculatedAmount,
        paymentStatus: 'pending'
    });
    
    await purchase.save();
    
    // Only after payment success callback:
    const validation = await validateUserRegistration(null, userData.email);
    if (validation.isValid) {
        // Create user, generate QR, send email
    }
});
            `
        },
        
        securityChecks: {
            description: "Regular security checks to maintain system integrity",
            recommendations: [
                "Run check-unpaid-users.js daily to monitor unpaid orders",
                "Run cleanupInvalidUsers() weekly to fix any inconsistencies",
                "Add payment verification to all user-facing features",
                "Monitor users trying to access features without payment",
                "Set up alerts for orders pending more than 24 hours"
            ]
        },
        
        frontendIntegration: {
            description: "Frontend should handle payment verification errors gracefully",
            example: `
// In your frontend code
try {
    const response = await fetch('/api/qrcode/123');
    if (response.status === 403) {
        const error = await response.json();
        if (error.error === 'PAYMENT_REQUIRED') {
            // Redirect to payment page
            window.location.href = '/payment';
        }
    }
} catch (error) {
    // Handle error
}
            `
        }
    };
}

module.exports = {
    verifyPaymentStatus,
    verifyUserHasCompletedPayment,
    checkFeatureAccess,
    validateUserRegistration,
    cleanupInvalidUsers,
    getImplementationGuide
};