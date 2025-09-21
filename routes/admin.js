const express = require("express");
const { User, Event, CheckoutOffer, PromoCode, Purchase, TeamComposition } = require("../models/models");
const { verifyAdmin } = require("../middleware/auth");
const { sendRegistrationEmail } = require("../utils/emailService");
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Promo code validation endpoint (for frontend)
router.post('/promo-codes/validate', async (req, res) => {
  try {
    const { code, userEmail, orderAmount } = req.body;

    if (!code || !userEmail || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!promoCode) {
      return res.status(200).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    const currentDate = new Date();
    
    // Check validity period
    if (currentDate < promoCode.validFrom || currentDate > promoCode.validUntil) {
      return res.status(200).json({
        success: false,
        message: 'Promo code has expired'
      });
    }

    // Check usage limit
    if (promoCode.usedCount >= promoCode.usageLimit) {
      return res.status(200).json({
        success: false,
        message: 'Promo code usage limit exceeded'
      });
    }

    // Check minimum order amount
    if (orderAmount < promoCode.minOrderAmount) {
      return res.status(200).json({
        success: false,
        message: `Minimum order amount is ₹${promoCode.minOrderAmount}`
      });
    }

    // Check email domain restriction
    if (promoCode.allowedEmailDomains.length > 0) {
      const userDomain = userEmail.split('@')[1];
      if (!promoCode.allowedEmailDomains.includes(userDomain)) {
        return res.status(200).json({
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


// Unified QR scanning route - handles both team leaders and team members
router.get("/verify/:id", verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // First try to find as User (main person/team leader)
    let person = await User.findById(id);
    let isTeamMember = false;
    let teamInfo = null;
    
    if (!person) {
      // If not found as User, try as TeamMember
      const teamMember = await TeamMember.findById(id);
      if (teamMember) {
        person = teamMember;
        isTeamMember = true;
        
        // Get team leader info for team members
        const mainPerson = await User.findById(teamMember.mainPersonId);
        if (mainPerson) {
          teamInfo = {
            teamId: mainPerson.teamId,
            teamLeader: {
              name: mainPerson.name,
              email: mainPerson.email,
              contactNo: mainPerson.contactNo
            }
          };
        }
      }
    } else if (person.isMainPerson && person.teamId) {
      // If it's a team leader, get team member count
      const teamMemberCount = await TeamMember.countDocuments({ mainPersonId: person._id });
      teamInfo = {
        teamId: person.teamId,
        teamSize: person.teamSize,
        teamMemberCount: teamMemberCount
      };
    }
    
    if (!person) {
      console.log(`❌ QR verification failed - Person not found: ${id}`);
      return res.status(404).json({ 
        success: false,
        error: 'Person not found',
        message: 'No user or team member found with this QR code'
      });
    }

    console.log(`👤 QR verification for ${person.name} (${person.email}):`, {
      hasEntered: person.hasEntered,
      entryTime: person.entryTime,
      isvalidated: person.isvalidated,
      isTeamMember: isTeamMember,
      teamInfo: teamInfo
    });

    const data = {
      success: true,
      _id: person._id,
      name: person.name,
      email: person.email,
      contactNo: person.contactNo || "",
      gender: person.gender || "",
      age: person.age || null,
      universityName: person.universityName || "",
      address: person.address || "",
      profileImage: person.profileImage || "",
      qrPath: person.qrPath || "",
      isvalidated: person.isvalidated,
      hasEntered: person.hasEntered,
      entryTime: person.entryTime,
      allowEntry: !person.hasEntered,
      isTeamMember: isTeamMember,
      isTeamLeader: !isTeamMember && person.isMainPerson,
      events: person.events || [],
      finalPrice: person.finalPrice || 0,
      // Team information
      teamInfo: teamInfo,
      // If it's a team member, include main person reference
      ...(isTeamMember && {
        mainPersonId: person.mainPersonId
      })
    };

    res.json(data); 

  } catch (error) {
    console.error('Error verifying QR code:', error);

    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify QR code'
      });
    }
  }
});

// Allow entry endpoint - UPDATED FOR TEAM SYSTEM
router.post("/allow-entry/:id", verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // First try to find as User (main person)
    let user = await User.findById(id);
    let isTeamMember = false;
    
    if (!user) {
      // If not found as User, try as TeamMember
      const teamMember = await TeamMember.findById(id);
      if (teamMember) {
        user = teamMember;
        isTeamMember = true;
      }
    }
    
    if (!user) {
      console.log(`❌ Allow entry failed - User not found: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        playBuzzer: true
      });
    }

    console.log(`🚪 Entry attempt for ${user.name} (${user.email}):`, {
      currentStatus: user.hasEntered ? 'Already entered' : 'Not entered yet',
      entryTime: user.entryTime,
      isTeamMember: isTeamMember
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
      entryTime: entryTime,
      isTeamMember: isTeamMember
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

// Get all users (admin only) - UPDATED FOR TEAM SYSTEM
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all team members (admin only)
router.get("/team-members", verifyAdmin, async (req, res) => {
  try {
    const teamMembers = await TeamMember.find({})
      .populate('mainPersonId', 'name email teamId');
    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team details by team ID (admin only)
router.get("/team/:teamId", verifyAdmin, async (req, res) => {
  try {
    const teamId = req.params.teamId;
    
    // Find main person by team ID
    const mainPerson = await User.findOne({ teamId: teamId, isMainPerson: true });
    if (!mainPerson) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Get team members
    const teamMembers = await TeamMember.find({ mainPersonId: mainPerson._id });

    res.json({
      success: true,
      team: {
        teamId: mainPerson.teamId,
        mainPerson: {
          id: mainPerson._id,
          name: mainPerson.name,
          email: mainPerson.email,
          contactNo: mainPerson.contactNo,
          gender: mainPerson.gender,
          age: mainPerson.age,
          universityName: mainPerson.universityName,
          address: mainPerson.address,
          profileImage: mainPerson.profileImage,
          qrPath: mainPerson.qrPath,
          hasEntered: mainPerson.hasEntered,
          entryTime: mainPerson.entryTime,
          events: mainPerson.events
        },
        teamMembers: teamMembers.map(member => ({
          id: member._id,
          name: member.name,
          email: member.email,
          contactNo: member.contactNo,
          gender: member.gender,
          age: member.age,
          universityName: member.universityName,
          address: member.address,
          profileImage: member.profileImage,
          qrPath: member.qrPath,
          hasEntered: member.hasEntered,
          entryTime: member.entryTime,
          events: member.events
        })),
        teamSize: mainPerson.teamSize
      }
    });

  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all teams with their members (admin only)
router.get("/teams", verifyAdmin, async (req, res) => {
  try {
    const teams = await User.find({ isMainPerson: true, teamId: { $exists: true } })
      .populate({
        path: 'teamMembers',
        model: 'TeamMember',
        match: { mainPersonId: { $exists: true } }
      });

    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        const teamMembers = await TeamMember.find({ mainPersonId: team._id });
        return {
          teamId: team.teamId,
          mainPerson: {
            id: team._id,
            name: team.name,
            email: team.email,
            contactNo: team.contactNo,
            gender: team.gender,
            age: team.age,
            universityName: team.universityName,
            address: team.address,
            profileImage: team.profileImage,
            qrPath: team.qrPath,
            hasEntered: team.hasEntered,
            entryTime: team.entryTime,
            events: team.events
          },
          teamMembers: teamMembers.map(member => ({
            id: member._id,
            name: member.name,
            email: member.email,
            contactNo: member.contactNo,
            gender: member.gender,
            age: member.age,
            universityName: member.universityName,
            address: member.address,
            profileImage: member.profileImage,
            qrPath: member.qrPath,
            hasEntered: member.hasEntered,
            entryTime: member.entryTime,
            events: member.events
          })),
          teamSize: team.teamSize
        };
      })
    );

    res.json(teamsWithMembers);

  } catch (error) {
    console.error('Error fetching teams:', error);
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
    const usedCodes = new Set();

    // Generate random alphanumeric string
    const generateRandomString = (length) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    for (let i = 0; i < count; i++) {
      let code;
      let attempts = 0;
      
      // Generate unique random code
      do {
        const randomSuffix = generateRandomString(6); // 6 character random suffix
        code = `${codePrefix}_${randomSuffix}`;
        attempts++;
        
        // Prevent infinite loop
        if (attempts > 100) {
          code = `${codePrefix}_${Date.now()}_${i}`;
          break;
        }
      } while (usedCodes.has(code));
      
      usedCodes.add(code);
      
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

// ========================= EMAIL MANAGEMENT ROUTES =========================

// Get all users with email status (admin only)
router.get("/users-email-status", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password')
      .populate('emailSentBy', 'name email')
      .sort({ createdAt: -1 });

    const usersWithEmailStatus = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      contactNo: user.contactNo,
      universityName: user.universityName,
      events: user.events,
      teamId: user.teamId,
      isMainPerson: user.isMainPerson,
      teamSize: user.teamSize,
      emailSent: user.emailSent,
      emailSentAt: user.emailSentAt,
      emailSentBy: user.emailSentBy,
      hasEntered: user.hasEntered,
      entryTime: user.entryTime,
      isvalidated: user.isvalidated,
      qrPath: user.qrPath,
      createdAt: user.createdAt || new Date()
    }));

    res.json({
      success: true,
      users: usersWithEmailStatus,
      totalUsers: usersWithEmailStatus.length,
      emailsSent: usersWithEmailStatus.filter(u => u.emailSent).length,
      emailsPending: usersWithEmailStatus.filter(u => !u.emailSent).length
    });

  } catch (error) {
    console.error('Error fetching users with email status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get team members with email status (admin only)
router.get("/team-members-email-status", verifyAdmin, async (req, res) => {
  try {
    const teamMembers = await TeamMember.find({})
      .populate('mainPersonId', 'name email teamId')
      .populate('emailSentBy', 'name email')
      .sort({ createdAt: -1 });

    const teamMembersWithStatus = teamMembers.map(member => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      contactNo: member.contactNo,
      universityName: member.universityName,
      events: member.events,
      mainPersonId: member.mainPersonId,
      emailSent: member.emailSent,
      emailSentAt: member.emailSentAt,
      emailSentBy: member.emailSentBy,
      hasEntered: member.hasEntered,
      entryTime: member.entryTime,
      isvalidated: member.isvalidated,
      qrPath: member.qrPath,
      createdAt: member.createdAt || new Date()
    }));

    res.json({
      success: true,
      teamMembers: teamMembersWithStatus,
      totalTeamMembers: teamMembersWithStatus.length,
      emailsSent: teamMembersWithStatus.filter(m => m.emailSent).length,
      emailsPending: teamMembersWithStatus.filter(m => !m.emailSent).length
    });

  } catch (error) {
    console.error('Error fetching team members with email status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send registration email to specific user (admin only)
router.post("/send-email/:userId", verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { userType = 'user' } = req.body; // 'user' or 'team-member'

    let user;
    let Model = userType === 'team-member' ? TeamMember : User;
    
    user = await Model.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType === 'team-member' ? 'Team member' : 'User'} not found`
      });
    }

    // Check if email already sent
    if (user.emailSent) {
      return res.status(400).json({
        success: false,
        message: 'Email already sent to this user'
      });
    }

    // Prepare user data for email
    let qrCodeBase64 = null;
    if (user.qrPath) {
      try {
        const qrFilePath = path.join(__dirname, '..', user.qrPath);
        if (fs.existsSync(qrFilePath)) {
          const qrBuffer = fs.readFileSync(qrFilePath);
          qrCodeBase64 = qrBuffer.toString('base64');
        }
      } catch (qrError) {
        console.log('QR code file not found, proceeding without QR code');
      }
    }

    const userData = {
      name: user.name,
      events: user.events || [],
      qrCodeBase64: qrCodeBase64
    };

    // Send email
    const emailResult = await sendRegistrationEmail(user.email, userData);

    if (emailResult.success) {
      // Update user email status
      user.emailSent = true;
      user.emailSentAt = new Date();
      user.emailSentBy = req.user.id;
      await user.save();

      res.json({
        success: true,
        message: `Registration email sent successfully to ${user.name}`,
        emailSentAt: user.emailSentAt
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send email: ${emailResult.error}`
      });
    }

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send bulk emails to all users who haven't received emails (admin only)
router.post("/send-bulk-emails", verifyAdmin, async (req, res) => {
  try {
    const { targetType = 'users' } = req.body; // 'users', 'team-members', or 'both'

    let results = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process main users
    if (targetType === 'users' || targetType === 'both') {
      const usersToEmail = await User.find({ emailSent: false });
      
      for (const user of usersToEmail) {
        try {
          let qrCodeBase64 = null;
          if (user.qrPath) {
            try {
              const qrFilePath = path.join(__dirname, '..', user.qrPath);
              if (fs.existsSync(qrFilePath)) {
                const qrBuffer = fs.readFileSync(qrFilePath);
                qrCodeBase64 = qrBuffer.toString('base64');
              }
            } catch (qrError) {
              console.log(`QR code not found for user ${user.name}`);
            }
          }

          const userData = {
            name: user.name,
            events: user.events || [],
            qrCodeBase64: qrCodeBase64
          };

          const emailResult = await sendRegistrationEmail(user.email, userData);
          
          if (emailResult.success) {
            user.emailSent = true;
            user.emailSentAt = new Date();
            user.emailSentBy = req.user.id;
            await user.save();
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(`${user.name} (${user.email}): ${emailResult.error}`);
          }
          
          results.totalProcessed++;
          
          // Add small delay to avoid overwhelming the email service
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (userError) {
          results.failed++;
          results.errors.push(`${user.name} (${user.email}): ${userError.message}`);
          results.totalProcessed++;
        }
      }
    }

    // Process team members
    if (targetType === 'team-members' || targetType === 'both') {
      const teamMembersToEmail = await TeamMember.find({ emailSent: false });
      
      for (const member of teamMembersToEmail) {
        try {
          let qrCodeBase64 = null;
          if (member.qrPath) {
            try {
              const qrFilePath = path.join(__dirname, '..', member.qrPath);
              if (fs.existsSync(qrFilePath)) {
                const qrBuffer = fs.readFileSync(qrFilePath);
                qrCodeBase64 = qrBuffer.toString('base64');
              }
            } catch (qrError) {
              console.log(`QR code not found for team member ${member.name}`);
            }
          }

          const userData = {
            name: member.name,
            events: member.events || [],
            qrCodeBase64: qrCodeBase64
          };

          const emailResult = await sendRegistrationEmail(member.email, userData);
          
          if (emailResult.success) {
            member.emailSent = true;
            member.emailSentAt = new Date();
            member.emailSentBy = req.user.id;
            await member.save();
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(`${member.name} (${member.email}): ${emailResult.error}`);
          }
          
          results.totalProcessed++;
          
          // Add small delay to avoid overwhelming the email service
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (memberError) {
          results.failed++;
          results.errors.push(`${member.name} (${member.email}): ${memberError.message}`);
          results.totalProcessed++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Bulk email sending completed',
      results: results
    });

  } catch (error) {
    console.error('Error sending bulk emails:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reset email status for a user (admin only)
router.post("/reset-email-status/:userId", verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { userType = 'user' } = req.body;

    let Model = userType === 'team-member' ? TeamMember : User;
    const user = await Model.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType === 'team-member' ? 'Team member' : 'User'} not found`
      });
    }

    user.emailSent = false;
    user.emailSentAt = null;
    user.emailSentBy = null;
    await user.save();

    res.json({
      success: true,
      message: `Email status reset for ${user.name}`
    });

  } catch (error) {
    console.error('Error resetting email status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;