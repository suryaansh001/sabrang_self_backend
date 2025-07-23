const express = require("express");
const { User, Event } = require("../models/models");
const { verifyAdmin } = require("../middleware/auth");
const router = express.Router();

// Verify user by ID (with entry tracking)
router.get("/verify/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        playBuzzer: true
      });
    }

    // Check if user has already entered
    if (user.hasEntered) {
      return res.json({
        success: false,
        message: 'Access denied - User has already entered',
        playBuzzer: true,
        entryTime: user.entryTime
      });
    }

    // Update user entry status
    user.hasEntered = true;
    user.entryTime = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Entry allowed successfully',
      playBuzzer: false,
      entryTime: user.entryTime
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

// Get all events (admin only)
router.get("/events", verifyAdmin, async (req,res)=>{
  try {
    const events = await Event.find({});
    return res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event (admin only)
router.post("/update", verifyAdmin, async (req,res)=>{
  try {
    const event = await Event.findByIdAndUpdate(req.body._id,{
      name:req.body.name,
      coordinator:req.body.coordinator,
      mobile:req.body.mobile,
      date:req.body.date,
      whatsappLink:req.body.whatsappLink,
    }, { new: true });
    
    if (event){
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
      link: req.body.link
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

module.exports = router;

module.exports = router;