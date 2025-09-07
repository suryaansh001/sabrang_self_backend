const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  events: [String],
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
  isvalidated:{
    type:Boolean,
    default:false
  },
  hasEntered:{
    type:Boolean,
    default:false
  },
  entryTime: {
    type: Date,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
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
  },
  price: {
    type: Number,
    default: 0
  },
  capacity: {
    type: Number,
    default: 100
  },
  registeredCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
    quantity: {
      type: Number,
      default: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
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
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: String,
  transactionId: String,
  purchaseDate: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better performance
checkoutOfferSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ allowedEmailDomains: 1 });

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const CheckoutOffer = mongoose.model("CheckoutOffer", checkoutOfferSchema);
const PromoCode = mongoose.model("PromoCode", promoCodeSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = { 
  User, 
  Event, 
  CheckoutOffer, 
  PromoCode, 
  Purchase 
};