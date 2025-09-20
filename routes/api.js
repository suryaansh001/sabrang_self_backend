require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { User, Event, TeamMember } = require("../models/models");
const { verifyToken,verifyAdmin } = require("../middleware/auth");
const path = require('path');
const fs = require('fs');
const qr = require('qr-image');

// QR code endpoint (accessible to authenticated users)
router.get('/qrcode/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Try to find user first
    let user = await User.findById(id);
    if (!user) {
      // If not found in User, try TeamMember
      const TeamMember = require('../models/models').TeamMember;
      user = await TeamMember.findById(id);
    }
    
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    // Check if QR code exists as base64
    if (user.qrCodeBase64) {
      res.type('png');
      res.send(Buffer.from(user.qrCodeBase64, 'base64'));
      return;
    }
    
    // Fallback to file system for backward compatibility
    const filename = `${id}.png`;
    const filePath = path.join(__dirname, '../public/qrcodes', filename);
    
    if (fs.existsSync(filePath)) {
      res.type('png');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    
    return res.status(404).send('QR code not found');
  } catch (error) {
    console.error('Error serving QR code:', error);
    res.status(500).send('Internal server error');
  }
});



router.get('/profile/:id', verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    if (!user.profileImage) {
      return res.status(404).send('No profile image set for this user');
    }

    const filePath = path.join(__dirname, '..', user.profileImage);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Profile image file not found');
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).send('Server error');
  }
});

// Get user data (requires authentication) - UPDATED FOR TEAM SYSTEM
router.get("/user", verifyToken, async (req,res)=>{
    try{
    console.log(req.user);
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

    // Get team members if user is main person
    let teamMembers = [];
    if (user.isMainPerson && user.teamId) {
      teamMembers = await TeamMember.find({ mainPersonId: user._id });
    }

    const data = {
      _id:user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage || "/images/default-avatar.jpg",
      qrPath:user.qrPath,
      registeredEvents: eventData,
      hasEntered: user.hasEntered,
      entryTime: user.entryTime,
      isAdmin: user.isAdmin,
      // Team-related fields
      isMainPerson: user.isMainPerson,
      teamId: user.teamId,
      teamSize: user.teamSize,
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
      }))
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

// Get team member QR code (accessible to authenticated users)
router.get('/team-member-qrcode/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Find team member
    const TeamMember = require('../models/models').TeamMember;
    const teamMember = await TeamMember.findById(id);
    
    if (!teamMember) {
      return res.status(404).send('Team member not found');
    }
    
    // Check if QR code exists as base64
    if (teamMember.qrCodeBase64) {
      res.type('png');
      res.send(Buffer.from(teamMember.qrCodeBase64, 'base64'));
      return;
    }
    
    // Fallback to file system for backward compatibility
    const filename = `${id}.png`;
    const filePath = path.join(__dirname, '../public/qrcodes', filename);
    
    if (fs.existsSync(filePath)) {
      res.type('png');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    
    return res.status(404).send('QR code not found');
  } catch (error) {
    console.error('Error serving team member QR code:', error);
    res.status(500).send('Internal server error');
  }
});

// Get team member profile image (accessible to authenticated users)
router.get('/team-member-profile/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const teamMember = await TeamMember.findById(id);
    if (!teamMember) {
      return res.status(404).send('Team member not found');
    }

    // Check if the requesting user is the main person of this team member
    if (teamMember.mainPersonId.toString() !== req.user._id.toString()) {
      return res.status(403).send('Access denied');
    }

    if (!teamMember.profileImage) {
      return res.status(404).send('No profile image set for this team member');
    }

    const filePath = path.join(__dirname, '..', teamMember.profileImage);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Profile image file not found');
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error fetching team member profile image:', error);
    res.status(500).send('Server error');
  }
});

// Get team details by team ID (accessible to authenticated users)
router.get('/team/:teamId', verifyToken, async (req, res) => {
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

    // Check if requesting user is the main person or admin
    if (mainPerson._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get team members
    const teamMembers = await TeamMember.find({ mainPersonId: mainPerson._id });

    // Get events data
    const events = mainPerson.events;
    const eventData = [];
    for (let i = 0; i < events.length; i++) {
      const info = await Event.findOne({ name: events[i] });
      if (info) {
        eventData.push(info);
      }
    }

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
        teamSize: mainPerson.teamSize,
        registeredEvents: eventData
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

// Get QR code by email (no authentication required)
router.post('/team-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailLower = email.toLowerCase().trim();
    let user = null;

    // Try to find in User collection first (main person)
    user = await User.findOne({ email: emailLower });
    
    // If not found in User, try TeamMember collection
    if (!user) {
      user = await TeamMember.findOne({ email: emailLower });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email address'
      });
    }
    
    // Check if QR code exists as base64
    if (user.qrCodeBase64) {
      res.type('png');
      res.send(Buffer.from(user.qrCodeBase64, 'base64'));
      return;
    }
    
    // Fallback to file system for backward compatibility
    const filename = `${user._id}.png`;
    const filePath = path.join(__dirname, '../public/qrcodes', filename);
    
    if (fs.existsSync(filePath)) {
      res.type('png');
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    
    return res.status(404).json({
      success: false,
      message: 'QR code not found for this user'
    });

  } catch (error) {
    console.error('Error serving QR code by email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;