const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { 
    type: String, 
    unique: true, // Ensure global uniqueness - one user per email
    required: true 
  },
  password: String,
  events: [String], // All events this user is registered for (can accumulate)
  qrPath: String,
  qrCodeBase64: String, // Single QR code for all events
  
  // Individual tracking
  isvalidated: {
    type: Boolean,
    default: false
  },
  hasEntered: {
    type: Boolean,
    default: false
  },
  entryTime: {
    type: Date,
    default: null
  },
  
  // User profile
  isAdmin: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: ""
  },
  universityIdCard: {
    type: String,
    default: ""
  },
  
  // User details captured from checkout form
  contactNo: {
    type: String,
    default: ""
  },
  gender: {
    type: String,
    default: ""
  },
  age: {
    type: Number,
    default: null
  },
  universityName: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
    // Referral code for user
    referralCode: {
      type: String,
      default: ""
    },
  
  // Support staff fields
  userType: {
    type: String,
    enum: ['participant', 'support_staff', 'flagship_visitor', 'flagship_solo_visitor'],
    default: 'participant'
  },
  supportRole: {
    type: String, // 'makeup', 'stylist', 'manager', etc.
    default: ""
  },
  governmentId: {
    type: String, // For support staff - government ID instead of university ID
    default: ""
  },
  idType: {
    type: String, // 'aadhar', 'passport', 'driving', 'other'
    default: ""
  },
  visitorPassDays: {
    type: Number,
    default: 0
  },
  
  // Team relationship tracking - stores all team participations
  teamRegistrations: [{
    eventName: String, // Which event this team registration is for
    teamLeaderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      default: null 
    },
    isTeamLeader: { type: Boolean, default: false },
    teamName: String,
    teamCompositionId: { // Link to team composition
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamComposition',
      default: null
    },
    registeredAt: { type: Date, default: Date.now }
  }],
  
  // Registration history - track all purchases this user was part of
  registrationHistory: [{
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    registrationType: { type: String, enum: ['individual', 'team-leader', 'team-member'] },
    eventsRegistered: [String],
    registeredAt: { type: Date, default: Date.now }
  }],
  
  // Email tracking fields
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  emailSentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const eventSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  link: String,
  coordinator: String,
  timings: String,
  date: String,
  whatsappLink: String,
  rules: {
    type: String,
    default: ""
  },
  image: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  prize: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    enum: ['Cultural', 'Technical', 'Management'],
    default: 'Cultural'
  }
});

// Team Composition Schema for Event Management
const teamCompositionSchema = new mongoose.Schema({
  eventName: { 
    type: String, 
    required: true 
  },
  teamName: {
    type: String,
    required: true
  },
  teamLeader: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    email: String,
    hasEntered: { type: Boolean, default: false },
    entryTime: Date
  },
  teamMembers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    email: String,
    hasEntered: { type: Boolean, default: false },
    entryTime: Date,
    role: String // Optional: 'developer', 'designer', etc.
  }],
  
  // Team metadata
  totalMembers: { type: Number, required: true },
  maxTeamSize: { type: Number, default: 25 }, // Updated to accommodate larger teams like Dance Battle (25 members)
  registrationComplete: { type: Boolean, default: true },
  
  // Entry tracking for entire team
  teamEntryStatus: {
    totalEntered: { type: Number, default: 0 },
    pendingEntry: { type: Number, default: 0 },
    allEntered: { type: Boolean, default: false },
    firstEntryTime: Date,
    lastEntryTime: Date
  },
  
  // Purchase tracking
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  paymentStatus: { type: String, enum: ['pending', 'completed'], default: 'completed' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Checkout/Combo Offers Schema
const checkoutOfferSchema = new mongoose.Schema({
  offerName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  events: [{
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    customPrice: {
      type: Number,
      default: null // If null, use original event price
    }
  }],
  comboPrice: {
    type: Number,
    required: true
  },
  originalTotalPrice: {
    type: Number,
    required: true
  },
  discountPercentage: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  maxPurchases: {
    type: Number,
    default: null // Unlimited if null
  },
  currentPurchases: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Promo Code Schema
const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscountAmount: {
    type: Number,
    default: null // For percentage discounts, cap the maximum discount
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: 1 // How many times this code can be used
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    orderAmount: Number,
    discountApplied: Number
  }],
  // Domain restriction for email-based promo codes
  allowedEmailDomains: [{
    type: String,
    lowercase: true
  }],
  // Applicable to specific events or all events
  applicableEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  // Applicable to specific offers or all offers
  applicableOffers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CheckoutOffer'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    default: ""
  }
});

// Purchase/Order Schema to track purchases
const purchaseSchema = new mongoose.Schema({
  // Order identification
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Will be set after user registration
    default: null
  },
  // Link purchase to the main person (team leader)
  mainPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  
  // User details captured during checkout
  userDetails: {
    name: String,
    email: String,
    contactNo: String,
    gender: String,
    age: Number,
    universityName: String,
    address: String,
    referralCode: String, // Added referral code field
    // Store complete form data
    formData: mongoose.Schema.Types.Mixed,
    teamMembers: [mongoose.Schema.Types.Mixed]
  },
  
  // Items and pricing
  items: [{
    type: {
      type: String,
      enum: ['event', 'offer'],
      required: true
    },
    itemId: {
      type: mongoose.Schema.Types.Mixed, // More flexible to handle string IDs or ObjectIds
      required: false // Make optional since we're storing itemName as well
    },
    itemName: String, // Store event/offer name for reference
    quantity: {
      type: Number,
      default: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  
  // Pricing details
  subtotal: {
    type: Number,
    required: true
  },
  promoCode: {
    code: String,
    discountAmount: Number
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Payment gateway integration
  paymentSessionId: {
    type: String, // Cashfree payment session ID
    default: null
  },
  cashfreeOrderId: {
    type: String, // Cashfree's internal order ID
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: String,
  transactionId: String,
  
  // Registration processing
  userRegistered: {
    type: Boolean,
    default: false
  },
  registrationError: String,
  
  // QR code generation
  qrGenerated: {
    type: Boolean,
    default: false
  },
  qrPath: String, // File path for backward compatibility
  qrCodeBase64: String, // Store QR code as base64 string
  
  // Email notification
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  
  // Timestamps
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  paymentCompletedAt: Date,
  
  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: String // 'checkout', 'admin', etc.
  }
});

// Add indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ events: 1 });
userSchema.index({ 'teamRegistrations.eventName': 1 });
teamCompositionSchema.index({ eventName: 1 });
teamCompositionSchema.index({ 'teamLeader.userId': 1 });
teamCompositionSchema.index({ 'teamMembers.userId': 1 });
purchaseSchema.index({ orderId: 1 });
purchaseSchema.index({ userId: 1 });
purchaseSchema.index({ mainPersonId: 1 });
purchaseSchema.index({ paymentSessionId: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ purchaseDate: -1 });
checkoutOfferSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ allowedEmailDomains: 1 });

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const TeamComposition = mongoose.model("TeamComposition", teamCompositionSchema);
const CheckoutOffer = mongoose.model("CheckoutOffer", checkoutOfferSchema);
const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = { 
  User, 
  Event, 
  TeamComposition,
  CheckoutOffer, 
  PromoCode, 
  Purchase
};
