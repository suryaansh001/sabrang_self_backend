const mongoose = require('mongoose');
const { Purchase, User, TeamComposition } = require('./models/models');

async function testPaymentSuccessCallback() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/sabrangDB');
        console.log('✅ Connected to MongoDB');

        // Find our test purchase
        const purchase = await Purchase.findOne({ orderId: 'TEST_ORDER_1758479499675' });
        if (!purchase) {
            console.log('❌ Test purchase not found');
            return;
        }

        console.log('🔍 Found purchase:', purchase.orderId);
        console.log('📧 Purchase email:', purchase.userDetails.email);
        console.log('💰 Payment status:', purchase.paymentStatus);

        // Simulate the payment success callback logic
        if (purchase.paymentStatus === 'completed') {
            console.log('💡 Simulating team member update logic...');

            // Find or create user
            let user = await User.findOne({ email: purchase.userDetails.email });
            if (!user) {
                console.log('👤 Creating new user...');
                user = new User({
                    name: purchase.userDetails.name,
                    email: purchase.userDetails.email,
                    contactNo: purchase.userDetails.contactNo || '',
                    isvalidated: true
                });
                await user.save();
            }

            console.log('👤 User found/created:', user._id);

            // Update team compositions for this user (if any)
            let teamMembers = [];
            console.log('🏆 Checking for team compositions to update for email:', user.email);
            
            // Find team compositions where this user is either team leader or team member
            const teamCompositions = await TeamComposition.find({
                $or: [
                    { 'teamLeader.email': user.email },
                    { 'teamMembers.email': user.email }
                ],
                paymentStatus: 'completed' // Changed to completed since we already processed
            }).populate('teamMembers.userId', 'name email contactNo');
            
            console.log(`🎯 Found ${teamCompositions.length} team compositions`);
            
            if (teamCompositions.length > 0) {
                // Extract team members for purchase record
                const allTeamMembers = new Set();
                
                for (const teamComp of teamCompositions) {
                    console.log(`🔍 Processing team: ${teamComp.teamName} (${teamComp.eventName})`);
                    console.log(`👥 Team has ${teamComp.teamMembers.length} members`);
                    
                    // Collect team members (excluding the leader)
                    teamComp.teamMembers.forEach(member => {
                        console.log(`🔍 Checking member: ${member.userId?.name} (${member.userId?.email})`);
                        if (member.userId && member.userId.email !== user.email) {
                            const memberData = {
                                name: member.userId.name,
                                email: member.userId.email,
                                contactNo: member.userId.contactNo || ''
                            };
                            allTeamMembers.add(JSON.stringify(memberData));
                            console.log(`✅ Added team member: ${memberData.name}`);
                        } else {
                            console.log(`⏭️ Skipping team leader: ${member.userId?.name}`);
                        }
                    });
                }
                
                // Convert Set back to array of objects
                teamMembers = Array.from(allTeamMembers).map(memberStr => JSON.parse(memberStr));
                
                console.log(`🎯 Total unique team members to add: ${teamMembers.length}`);
                
                // Update purchase with team information
                purchase.userDetails.teamMembers = teamMembers;
                purchase.mainPersonId = user._id; // Set main person as team leader
                purchase.qrGenerated = true; // Mark as processed
                
                await purchase.save();
                console.log(`💾 Updated purchase with ${teamMembers.length} team members`);
                
                // Verify the update
                const updatedPurchase = await Purchase.findOne({ orderId: purchase.orderId });
                console.log('✅ Verification - Team members in purchase:', updatedPurchase.userDetails.teamMembers.length);
                console.log('✅ Verification - Main person ID:', updatedPurchase.mainPersonId);
                
            } else {
                console.log('ℹ️ No team compositions found for this user');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from database');
    }
}

testPaymentSuccessCallback();
