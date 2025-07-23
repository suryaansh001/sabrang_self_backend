require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { User, Event } = require("../models/models");
const { verifyToken } = require("../middleware/auth");
const path = require('path');
const fs = require('fs');
const qr = require('qr-image');

// QR code endpoint (accessible to authenticated users)
router.get('/qrcode/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  const filename = `${id}.png`;
  const filePath = path.join(__dirname, '../public/qrcodes', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('QR code not found'); 
  }

  res.type('png');
  fs.createReadStream(filePath).pipe(res);
});

// Get user data (requires authentication)
router.get("/user", verifyToken, async (req,res)=>{
    try{
    
    const user = req.user; // User is already available from verifyToken middleware
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const events = user.events;
    const eventData = [];
    for (i=0;i<events.length;i++){
      const info = await Event.findOne({name:events[i]});
      if (info) {
        eventData.push(info);
      }
    }

    const data = {
      _id:user._id,
      name: user.name,
      email: user.email,
      profileImage: "/images/default-avatar.jpg",
      qrPath:user.qrPath,
      registeredEvents: eventData,
      hasEntered: user.hasEntered,
      entryTime: user.entryTime,
      isAdmin: user.isAdmin
    }

    return res.send(data)
    }catch (e){
        return res.status(401).send({
            message:"unauthenticated"
        })
    }   
});

// Get public events (no authentication required)
router.get("/events", async (req, res) => {
  try {
    const events = await Event.find({});
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register for event (requires authentication)
router.post("/register-event", verifyToken, async (req, res) => {
  try {
    const { eventName } = req.body;
    const user = req.user;

    if (!eventName) {
      return res.status(400).json({
        success: false,
        message: "Event name is required"
      });
    }

    // Check if event exists
    const event = await Event.findOne({ name: eventName });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Check if user is already registered
    if (user.events.includes(eventName)) {
      return res.status(400).json({
        success: false,
        message: "Already registered for this event"
      });
    }

    // Add event to user's events
    user.events.push(eventName);
    await user.save();

    res.json({
      success: true,
      message: "Successfully registered for event"
    });

  } catch (error) {
    console.error('Error registering for event:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

module.exports = router;



module.exports = router;