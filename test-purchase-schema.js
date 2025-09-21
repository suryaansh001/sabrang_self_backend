const mongoose = require('mongoose');
const { User, TeamComposition, Purchase } = require('./models/models');

async function connectDB() {
  try {
    const mongoUri = process.env.mongodb || 'mongodb://localhost:27017/sabrang';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function checkPurchaseSchema() {
  try {
    console.log('🔍 Checking Purchase Schema and Data...\n');
    
    // Get all purchases
    const purchases = await Purchase.find({})
      .populate('userId', 'name email events')
      .populate('mainPersonId', 'name email events')
      .sort({ purchaseDate: -1 });
    
    console.log(`📊 TOTAL PURCHASES FOUND: ${purchases.length}\n`);
    
    if (purchases.length === 0) {
      console.log('📭 No purchases found in database');
      return;
    }
    
    purchases.forEach((purchase, index) => {
      console.log(`💳 PURCHASE ${index + 1}:`);
      console.log('=======================');
      console.log(`Order ID: ${purchase.orderId}`);
      console.log(`Payment Session ID: ${purchase.paymentSessionId}`);
      console.log(`Payment Status: ${purchase.paymentStatus}`);
      console.log(`Purchase Date: ${purchase.purchaseDate}`);
      console.log(`Payment Completed At: ${purchase.paymentCompletedAt || 'N/A'}`);
      console.log(`Subtotal: ${purchase.subtotal || 'N/A'}`);
      console.log(`Total Amount: ${purchase.totalAmount || 'N/A'}`);
      
      // User details
      console.log(`\n👤 USER DETAILS:`);
      console.log(`Name: ${purchase.userDetails.name}`);
      console.log(`Email: ${purchase.userDetails.email}`);
      console.log(`Contact: ${purchase.userDetails.contactNo || 'N/A'}`);
      console.log(`Gender: ${purchase.userDetails.gender || 'N/A'}`);
      console.log(`Age: ${purchase.userDetails.age || 'N/A'}`);
      console.log(`University: ${purchase.userDetails.universityName || 'N/A'}`);
      console.log(`Address: ${purchase.userDetails.address || 'N/A'}`);
      console.log(`Referral Code: ${purchase.userDetails.referralCode || 'N/A'}`);
      
      // Team members from userDetails
      if (purchase.userDetails.teamMembers && purchase.userDetails.teamMembers.length > 0) {
        console.log(`\n👥 TEAM MEMBERS IN PURCHASE (${purchase.userDetails.teamMembers.length}):`);
        purchase.userDetails.teamMembers.forEach((member, memberIndex) => {
          console.log(`${memberIndex + 1}. ${JSON.stringify(member, null, 2)}`);
        });
      } else {
        console.log(`\n👥 TEAM MEMBERS IN PURCHASE: None stored`);
      }
      
      // Form data
      if (purchase.userDetails.formData) {
        console.log(`\n📋 FORM DATA:`);
        console.log(JSON.stringify(purchase.userDetails.formData, null, 2));
      }
      
      // Items
      console.log(`\n📦 ITEMS (${purchase.items.length}):`);
      purchase.items.forEach((item, itemIndex) => {
        console.log(`${itemIndex + 1}. ${item.itemName} - ${item.type} - Qty: ${item.quantity} - Price: ${item.price}`);
      });
      
      // Linked user
      if (purchase.userId) {
        console.log(`\n🔗 LINKED USER:`);
        console.log(`ID: ${purchase.userId._id}`);
        console.log(`Name: ${purchase.userId.name}`);
        console.log(`Email: ${purchase.userId.email}`);
        console.log(`Events: [${purchase.userId.events.join(', ')}]`);
      } else {
        console.log(`\n🔗 LINKED USER: None`);
      }
      
      // Main person
      if (purchase.mainPersonId) {
        console.log(`\n👑 MAIN PERSON:`);
        console.log(`ID: ${purchase.mainPersonId._id}`);
        console.log(`Name: ${purchase.mainPersonId.name}`);
        console.log(`Email: ${purchase.mainPersonId.email}`);
        console.log(`Events: [${purchase.mainPersonId.events.join(', ')}]`);
      } else {
        console.log(`\n👑 MAIN PERSON: None`);
      }
      
      // QR Info
      console.log(`\n📱 QR INFO:`);
      console.log(`QR Generated: ${purchase.qrGenerated || false}`);
      console.log(`QR Code Base64: ${purchase.qrCodeBase64 ? 'Available' : 'Not available'}`);
      
      console.log('\n' + '─'.repeat(50) + '\n');
    });
    
    // Find related team compositions for these purchases
    console.log('🏆 RELATED TEAM COMPOSITIONS:\n');
    
    const teamCompositions = await TeamComposition.find({
      purchaseId: { $in: purchases.map(p => p._id) }
    }).populate('teamLeader.userId teamMembers.userId');
    
    if (teamCompositions.length > 0) {
      teamCompositions.forEach((team, index) => {
        console.log(`${index + 1}. Team: ${team.teamName} (${team.eventName})`);
        console.log(`   Purchase ID: ${team.purchaseId}`);
        console.log(`   Payment Status: ${team.paymentStatus}`);
        console.log(`   Team Leader: ${team.teamLeader.name} (${team.teamLeader.email})`);
        console.log(`   Team Members: ${team.teamMembers.length}`);
        console.log();
      });
    } else {
      console.log('No team compositions linked to purchases');
    }
    
  } catch (error) {
    console.error('❌ Error checking purchase schema:', error);
  }
}

async function testPurchaseSchemaFields() {
  try {
    console.log('\n🧪 TESTING PURCHASE SCHEMA FIELDS:\n');
    
    // Get the Purchase model schema
    const PurchaseModel = mongoose.model('Purchase');
    const schema = PurchaseModel.schema;
    
    console.log('📋 PURCHASE SCHEMA STRUCTURE:');
    console.log('===============================');
    
    // List all schema paths
    Object.keys(schema.paths).forEach(path => {
      const schemaType = schema.paths[path];
      const isRequired = schemaType.isRequired || false;
      const hasDefault = schemaType.defaultValue !== undefined;
      const type = schemaType.instance || schemaType.constructor.name;
      
      console.log(`${path}: ${type}${isRequired ? ' (required)' : ''}${hasDefault ? ' (has default)' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing schema fields:', error);
  }
}

async function main() {
  await connectDB();
  
  await checkPurchaseSchema();
  await testPurchaseSchemaFields();
  
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from database');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
