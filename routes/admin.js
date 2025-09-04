const express = require("express");
const { User, Event, CheckoutOffer, PromoCode, Purchase } = require("../models/models");
const { verifyAdmin } = require("../middleware/auth");
const router = express.Router();


// Verify user by ID (with entry tracking)
router.get("/verify/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      console.log(`❌ User verification failed - User not found: ${req.params.id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`👤 User verification for ${user.name} (${user.email}):`, {
      hasEntered: user.hasEntered,
      entryTime: user.entryTime,
      isvalidated: user.isvalidated
    });

    const data = {
      _id: user._id,
      name: user.name,
      email: user.email,
      isvalidated: user.isvalidated,
      hasEntered: user.hasEntered,
      entryTime: user.entryTime,
      allowEntry: !user.hasEntered
    };

    res.json(data); 

  } catch (error) {
    console.error('Error verifying user:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Allow entry endpoint
router.post("/allow-entry/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      console.log(`❌ Allow entry failed - User not found: ${req.params.id}`);
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        playBuzzer: true
      });
    }

    console.log(`🚪 Entry attempt for ${user.name} (${user.email}):`, {
      currentStatus: user.hasEntered ? 'Already entered' : 'Not entered yet',
      entryTime: user.entryTime
    });

    // Check if user has already entered
    if (user.hasEntered) {
      console.log(`🚫 Entry denied - ${user.name} has already entered at ${user.entryTime}`);
      return res.json({
        success: false,
        message: 'Access denied - User has already entered',
        playBuzzer: true,
        entryTime: user.entryTime
      });
    }

    // Update user entry status
    const entryTime = new Date();
    user.hasEntered = true;
    user.entryTime = entryTime;
    await user.save();

    console.log(`✅ Entry allowed - ${user.name} successfully entered at ${entryTime}`);

    res.json({
      success: true,
      message: 'Entry allowed successfully',
      playBuzzer: false,
      entryTime: entryTime
    });

  } catch (error) {
    console.error('Error allowing entry:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      playBuzzer: true
    });
  }
});

// Get all events (public endpoint for frontend)
router.get("/events-public", async (req, res) => {
  try {
    const events = await Event.find({});
    return res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all events (admin only)
router.get("/events", verifyAdmin, async (req, res) => {
  try {
    const events = await Event.find({});
    return res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event by name (public endpoint for frontend)
router.get("/event/:name", async (req, res) => {
  try {
    const eventName = req.params.name;
    const event = await Event.findOne({ name: { $regex: new RegExp(eventName, 'i') } });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event (admin only)
router.post("/update", verifyAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.body._id, {
      name: req.body.name,
      coordinator: req.body.coordinator,
      mobile: req.body.mobile,
      date: req.body.date,
      whatsappLink: req.body.whatsappLink,
      rules: req.body.rules,
      image: req.body.image,
      description: req.body.description,
      prize: req.body.prize,
      category: req.body.category,
      timings: req.body.timings,
      link: req.body.link
    }, { new: true });
    
    if (event) {
      res.status(200).json({
        success: true,
        message: 'Event updated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add new event (admin only)
router.post("/add-event", verifyAdmin, async (req, res) => {
  try {
    const newEvent = new Event({
      name: req.body.name,
      coordinator: req.body.coordinator,
      mobile: req.body.mobile,
      date: req.body.date,
      whatsappLink: req.body.whatsappLink,
      timings: req.body.timings,
      link: req.body.link,
      rules: req.body.rules || "",
      image: req.body.image || "",
      description: req.body.description || "",
      prize: req.body.prize || "",
      category: req.body.category || "Cultural"
    });

    await newEvent.save();

    res.status(201).json({
      success: true,
      message: 'Event added successfully',
      event: newEvent
    });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users (admin only)
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= CHECKOUT OFFER ROUTES =========================

// Get all checkout offers (admin only)
router.get("/checkout-offers", verifyAdmin, async (req, res) => {
  try {
    const offers = await CheckoutOffer.find({})
      .populate('events.eventId', 'name category prize')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(offers);
  } catch (error) {
    console.error('Error fetching checkout offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active checkout offers (public)
router.get("/checkout-offers-public", async (req, res) => {
  try {
    const currentDate = new Date();
    const offers = await CheckoutOffer.find({
      isActive: true,
      validFrom: { $lte: currentDate },
      validUntil: { $gte: currentDate },
      $expr: {
        $or: [
          { $eq: ["$maxPurchases", null] },
          { $lt: ["$currentPurchases", "$maxPurchases"] }
        ]
      }
    })
    .populate('events.eventId', 'name category prize description image')
    .sort({ createdAt: -1 });
    
    res.json(offers);
  } catch (error) {
    console.error('Error fetching active checkout offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create checkout offer (admin only)
router.post("/checkout-offers", verifyAdmin, async (req, res) => {
  try {
    const {
      offerName,
      description,
      events,
      comboPrice,
      validUntil,
      maxPurchases
    } = req.body;

    // Calculate original total price
    let originalTotalPrice = 0;
    for (const eventItem of events) {
      const event = await Event.findById(eventItem.eventId);
      if (!event) {
        return res.status(400).json({
          success: false,
          message: `Event not found: ${eventItem.eventId}`
        });
      }
      // Use custom price if provided, otherwise use event's default price (assuming you add price field to Event schema)
      originalTotalPrice += eventItem.customPrice || event.price || 0;
    }

    const discountPercentage = originalTotalPrice > 0 
      ? Math.round(((originalTotalPrice - comboPrice) / originalTotalPrice) * 100)
      : 0;

    const newOffer = new CheckoutOffer({
      offerName,
      description,
      events,
      comboPrice,
      originalTotalPrice,
      discountPercentage,
      validUntil: new Date(validUntil),
      maxPurchases,
      createdBy: req.user.id // Assuming verifyAdmin middleware adds user to req
    });

    await newOffer.save();

    const populatedOffer = await CheckoutOffer.findById(newOffer._id)
      .populate('events.eventId', 'name category')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Checkout offer created successfully',
      offer: populatedOffer
    });

  } catch (error) {
    console.error('Error creating checkout offer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update checkout offer (admin only)
router.put("/checkout-offers/:id", verifyAdmin, async (req, res) => {
  try {
    const offerId = req.params.id;
    const updates = req.body;

    // Recalculate discount if events or combo price changed
    if (updates.events || updates.comboPrice) {
      let originalTotalPrice = 0;
      const eventsToCheck = updates.events || (await CheckoutOffer.findById(offerId)).events;
      
      for (const eventItem of eventsToCheck) {
        const event = await Event.findById(eventItem.eventId);
        originalTotalPrice += eventItem.customPrice || event.price || 0;
      }

      updates.originalTotalPrice = originalTotalPrice;
      updates.discountPercentage = originalTotalPrice > 0 
        ? Math.round(((originalTotalPrice - (updates.comboPrice || 0)) / originalTotalPrice) * 100)
        : 0;
    }

    const updatedOffer = await CheckoutOffer.findByIdAndUpdate(
      offerId, 
      updates, 
      { new: true }
    )
    .populate('events.eventId', 'name category')
    .populate('createdBy', 'name email');

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Checkout offer not found'
      });
    }

    res.json({
      success: true,
      message: 'Checkout offer updated successfully',
      offer: updatedOffer
    });

  } catch (error) {
    console.error('Error updating checkout offer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete checkout offer (admin only)
router.delete("/checkout-offers/:id", verifyAdmin, async (req, res) => {
  try {
    const deletedOffer = await CheckoutOffer.findByIdAndDelete(req.params.id);
    
    if (!deletedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Checkout offer not found'
      });
    }

    res.json({
      success: true,
      message: 'Checkout offer deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting checkout offer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ========================= PROMO CODE ROUTES =========================

// Get all promo codes (admin only)
router.get("/promo-codes", verifyAdmin, async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({})
      .populate('applicableEvents', 'name category')
      .populate('applicableOffers', 'offerName')
      .populate('createdBy', 'name email')
      .populate('usedBy.userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(promoCodes);
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create promo code (admin only)
router.post("/promo-codes", verifyAdmin, async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validUntil,
      usageLimit,
      allowedEmailDomains,
      applicableEvents,
      applicableOffers,
      description
    } = req.body;

    const newPromoCode = new PromoCode({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount: minOrderAmount || 0,
      validUntil: new Date(validUntil),
      usageLimit: usageLimit || 1,
      allowedEmailDomains: allowedEmailDomains || [],
      applicableEvents: applicableEvents || [],
      applicableOffers: applicableOffers || [],
      description,
      createdBy: req.user.id
    });

    await newPromoCode.save();

    const populatedPromoCode = await PromoCode.findById(newPromoCode._id)
      .populate('applicableEvents', 'name category')
      .populate('applicableOffers', 'offerName')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Promo code created successfully',
      promoCode: populatedPromoCode
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }
    console.error('Error creating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Bulk create promo codes (admin only)
router.post("/promo-codes/bulk", verifyAdmin, async (req, res) => {
  try {
    const {
      codePrefix,
      count,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validUntil,
      allowedEmailDomains,
      applicableEvents,
      applicableOffers,
      description
    } = req.body;

    const promoCodes = [];
    const createdCodes = [];

    for (let i = 1; i <= count; i++) {
      const code = `${codePrefix}${String(i).padStart(4, '0')}`;
      
      const promoCode = {
        code,
        discountType,
        discountValue,
        maxDiscountAmount,
        minOrderAmount: minOrderAmount || 0,
        validUntil: new Date(validUntil),
        usageLimit: 1,
        allowedEmailDomains: allowedEmailDomains || [],
        applicableEvents: applicableEvents || [],
        applicableOffers: applicableOffers || [],
        description,
        createdBy: req.user.id
      };

      promoCodes.push(promoCode);
      createdCodes.push(code);
    }

    await PromoCode.insertMany(promoCodes);

    res.status(201).json({
      success: true,
      message: `${count} promo codes created successfully`,
      codes: createdCodes
    });

  } catch (error) {
    console.error('Error bulk creating promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Validate promo code (public)
router.post("/promo-codes/validate", async (req, res) => {
  try {
    const { code, userEmail, orderAmount } = req.body;

    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    const currentDate = new Date();
    
    // Check validity period
    if (currentDate < promoCode.validFrom || currentDate > promoCode.validUntil) {
      return res.json({
        success: false,
        message: 'Promo code has expired'
      });
    }

    // Check usage limit
    if (promoCode.usedCount >= promoCode.usageLimit) {
      return res.json({
        success: false,
        message: 'Promo code usage limit exceeded'
      });
    }

    // Check minimum order amount
    if (orderAmount < promoCode.minOrderAmount) {
      return res.json({
        success: false,
        message: `Minimum order amount is ₹${promoCode.minOrderAmount}`
      });
    }

    // Check email domain restriction
    if (promoCode.allowedEmailDomains.length > 0) {
      const userDomain = userEmail.split('@')[1];
      if (!promoCode.allowedEmailDomains.includes(userDomain)) {
        return res.json({
          success: false,
          message: 'This promo code is not valid for your email domain'
        });
      }
    }

    // Calculate discount
    let discountAmount;
    if (promoCode.discountType === 'percentage') {
      discountAmount = (orderAmount * promoCode.discountValue) / 100;
      if (promoCode.maxDiscountAmount && discountAmount > promoCode.maxDiscountAmount) {
        discountAmount = promoCode.maxDiscountAmount;
      }
    } else {
      discountAmount = promoCode.discountValue;
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    res.json({
      success: true,
      message: 'Promo code is valid',
      discountAmount,
      finalAmount: orderAmount - discountAmount
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update promo code (admin only)
router.put("/promo-codes/:id", verifyAdmin, async (req, res) => {
  try {
    const promoCodeId = req.params.id;
    const updates = req.body;

    const updatedPromoCode = await PromoCode.findByIdAndUpdate(
      promoCodeId,
      updates,
      { new: true }
    )
    .populate('applicableEvents', 'name category')
    .populate('applicableOffers', 'offerName')
    .populate('createdBy', 'name email');

    if (!updatedPromoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo code updated successfully',
      promoCode: updatedPromoCode
    });

  } catch (error) {
    console.error('Error updating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete promo code (admin only)
router.delete("/promo-codes/:id", verifyAdmin, async (req, res) => {
  try {
    const deletedPromoCode = await PromoCode.findByIdAndDelete(req.params.id);
    
    if (!deletedPromoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ========================= ANALYTICS ROUTES =========================

// Get dashboard analytics (admin only)
router.get("/analytics/dashboard", verifyAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalOffers,
      totalPromoCodes,
      activePurchases,
      usedPromoCodes
    ] = await Promise.all([
      User.countDocuments({}),
      Event.countDocuments({}),
      CheckoutOffer.countDocuments({ isActive: true }),
      PromoCode.countDocuments({ isActive: true }),
      Purchase.countDocuments({ paymentStatus: 'completed' }),
      PromoCode.countDocuments({ usedCount: { $gt: 0 } })
    ]);

    const totalRevenue = await Purchase.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      totalUsers,
      totalEvents,
      totalOffers,
      totalPromoCodes,
      activePurchases,
      usedPromoCodes,
      totalRevenue: totalRevenue[0]?.total || 0
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;