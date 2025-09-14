const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  events: [String],
  // Total payable amount for the current registration (team leader only)
  finalPrice: {
    type: Number,
    default: 0
  },
  referalID: String,
  referalcount: {
    type: Number,
    default: 0
  },
  qrPath: String,
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
  isAdmin: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: ""
  },
  // Optional details captured from checkout form
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
  // Store full raw form payload from frontend to avoid data loss
  extraDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  teamMembers: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  // Full raw payload snapshot for audit/debugging
  rawRegistration: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Team management fields
  teamId: {
    type: String,
    default: null // Unique team identifier for main person
  },
  isMainPerson: {
    type: Boolean,
    default: true // True for main person, false for individual registrations
  },
  teamSize: {
    type: Number,
    default: 1 // Total team size including main person
  },
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

// New Checkout/Combo Offers Schema
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

// New Promo Code Schema
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
    required: true
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
      type: mongoose.Schema.Types.ObjectId,
      required: true // Can reference Event or CheckoutOffer
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
  qrPath: String,
  
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
purchaseSchema.index({ orderId: 1 });
purchaseSchema.index({ userId: 1 });
purchaseSchema.index({ paymentSessionId: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ purchaseDate: -1 });

// Add indexes for better performance
checkoutOfferSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ allowedEmailDomains: 1 });

// Team Member Schema - Individual team members linked to main person
const teamMemberSchema = new mongoose.Schema({
  mainPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
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
  profileImage: {
    type: String,
    default: ""
  },
  // QR code for individual team member
  qrPath: {
    type: String,
    default: ""
  },
  // Entry tracking for individual members
  hasEntered: {
    type: Boolean,
    default: false
  },
  entryTime: {
    type: Date,
    default: null
  },
  isvalidated: {
    type: Boolean,
    default: false
  },
  // Events this team member is registered for
  events: [String],
  // Additional details from registration form
  extraDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better performance
teamMemberSchema.index({ mainPersonId: 1 });
teamMemberSchema.index({ email: 1 });

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const CheckoutOffer = mongoose.model("CheckoutOffer", checkoutOfferSchema);
const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);
const TeamMember = mongoose.model("TeamMember", teamMemberSchema);

module.exports = { 
  User, 
  Event, 
  CheckoutOffer, 
  PromoCode, 
  Purchase,
  TeamMember
};