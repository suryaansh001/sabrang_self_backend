require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { User, Event, TeamMember } = require("../models/models");
const { verifyToken,verifyAdmin } = require("../middleware/auth");
const { sendPaymentInitiatedEmail, sendEmailToAllTeamMembers } = require("../utils/emailService");
const path = require('path');
const fs = require('fs');
const qr = require('qr-image');

// In-memory OTP storage (secure and simple without DB changes)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP for ticket access
router.post('/send-ticket-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailKey = email.toLowerCase().trim();

    // Check if user exists (team leader or individual)
    let user = await User.findOne({ 
      email: emailKey
    });
    
    // If not found in User, check TeamMember
    let isTeamMember = false;
    let teamMember = null;
    let mainPerson = null;
    
    if (!user) {
      teamMember = await TeamMember.findOne({ 
        email: emailKey
      });
      
      if (teamMember) {
        isTeamMember = true;
        // Get the main person details for events
        mainPerson = await User.findById(teamMember.mainPersonId);
        user = mainPerson; // Use main person's data for events
      }
    }
    
    if (!user && !teamMember) {
      return res.status(404).json({
        success: false,
        message: 'No registration found for this email address'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Store OTP in memory with additional info
    otpStore.set(emailKey, {
      otp,
      expiry: otpExpiry,
      attempts: 0,
      isTeamMember,
      teamMemberId: teamMember ? teamMember._id : null,
      mainPersonId: isTeamMember ? teamMember.mainPersonId : user._id
    });

    // Get user's registered events
    const userEvents = user.events || [];
    const eventData = [];
    for (let i = 0; i < userEvents.length; i++) {
      const event = await Event.findOne({ name: userEvents[i] });
      if (event) {
        eventData.push(event.name);
      }
    }

    // Send OTP via email (use team member's name if applicable)
    const recipientName = isTeamMember ? teamMember.name : user.name;
    const emailResult = await sendPaymentInitiatedEmail({
      email: emailKey,
      name: recipientName,
      otp: otp,
      events: eventData.length > 0 ? eventData : ['Dance Competition', 'Coding Contest', 'Business Plan']
    });

    if (emailResult.success) {
      console.log(`✅ OTP sent to ${email}: ${otp}`);
      res.json({
        success: true,
        message: 'OTP sent successfully to your email'
      });
    } else {
      // Remove OTP from store if email failed
      otpStore.delete(emailKey);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify OTP and return session token
router.post('/verify-ticket-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const emailKey = email.toLowerCase().trim();
    const storedOtpData = otpStore.get(emailKey);

    if (!storedOtpData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    // Check expiry
    if (Date.now() > storedOtpData.expiry) {
      otpStore.delete(emailKey);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check attempts (max 3 attempts)
    if (storedOtpData.attempts >= 3) {
      otpStore.delete(emailKey);
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (otp !== storedOtpData.otp) {
      storedOtpData.attempts++;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - storedOtpData.attempts} attempts remaining.`
      });
    }

    // OTP verified successfully
    otpStore.delete(emailKey);

    // Generate temporary access token (valid for 30 minutes)
    const tempToken = jwt.sign(
      { email: emailKey, purpose: 'ticket-access' },
      process.env.jwtkey || 'fallback-secret',
      { expiresIn: '30m' }
    );

    res.json({
      success: true,
      message: 'OTP verified successfully',
      accessToken: tempToken
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// QR code endpoint (publicly accessible)
router.get('/qrcode/:id', async (req, res) => {
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

// Get team member QR code (publicly accessible)
router.get('/team-member-qrcode/:id', async (req, res) => {
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

// Get team data by team member email (requires OTP verification)
router.post('/team-by-email', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Access token required. Please verify OTP first.'
      });
    }

    // Verify the temporary access token
    let email;
    try {
      const decoded = jwt.verify(accessToken, process.env.jwtkey || 'fallback-secret');
      if (decoded.purpose !== 'ticket-access') {
        throw new Error('Invalid token purpose');
      }
      email = decoded.email;
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token. Please verify OTP again.'
      });
    }

    const emailKey = email.toLowerCase().trim();

    // First check if it's an individual participant
    let individualUser = await User.findOne({ 
      email: emailKey,
      $or: [
        { isMainPerson: { $ne: true } }, // Not a team leader
        { isMainPerson: { $exists: false } }, // Field doesn't exist (individual)
        { teamSize: { $lte: 1 } } // Team size is 1 or less (individual)
      ]
    });

    if (individualUser && (!individualUser.isMainPerson || individualUser.teamSize <= 1)) {
      // This is an individual participant
      const events = individualUser.events;
      const eventData = [];
      for (let i = 0; i < events.length; i++) {
        const info = await Event.findOne({ name: events[i] });
        if (info) {
          eventData.push(info);
        }
      }

      return res.json({
        success: true,
        isIndividual: true,
        participant: {
          id: individualUser._id,
          name: individualUser.name,
          email: individualUser.email,
          contactNo: individualUser.contactNo,
          gender: individualUser.gender,
          age: individualUser.age,
          universityName: individualUser.universityName,
          address: individualUser.address,
          profileImage: individualUser.profileImage,
          qrPath: individualUser.qrPath,
          qrCodeBase64: individualUser.qrCodeBase64,
          hasEntered: individualUser.hasEntered,
          entryTime: individualUser.entryTime,
          events: individualUser.events,
          registeredEvents: eventData,
          accessedBy: emailKey
        }
      });
    }

    // Find the user by email (could be team leader or team member)
    let mainPerson = await User.findOne({ 
      email: emailKey,
      isMainPerson: true 
    });
    
    // If not found as main person, check if it's a team member
    if (!mainPerson) {
      const teamMember = await TeamMember.findOne({ 
        email: emailKey
      });
      
      if (teamMember) {
        // Get the main person for this team member
        mainPerson = await User.findById(teamMember.mainPersonId);
      }
    }
    
    if (!mainPerson) {
      return res.status(404).json({
        success: false,
        message: 'No registration found for this email address'
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
      isIndividual: false,
      team: {
        teamId: mainPerson.teamId || mainPerson._id,
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
          qrCodeBase64: mainPerson.qrCodeBase64,
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
          qrCodeBase64: member.qrCodeBase64,
          hasEntered: member.hasEntered,
          entryTime: member.entryTime,
          events: member.events
        })),
        teamSize: mainPerson.teamSize || (1 + teamMembers.length),
        registeredEvents: eventData,
        // Indicate which email was used to access
        accessedBy: emailKey
      }
    });

  } catch (error) {
    console.error('Error fetching data by email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send registration confirmation email to all team members
router.post('/send-team-emails', verifyToken, async (req, res) => {
  try {
    const { teamId, emailType = 'registration' } = req.body;
    const user = req.user;

    // Find the team by teamId or use the current user's team
    let mainPerson;
    if (teamId) {
      mainPerson = await User.findOne({ teamId: teamId, isMainPerson: true });
    } else if (user.isMainPerson) {
      mainPerson = user;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Team ID required or user must be a team leader'
      });
    }

    if (!mainPerson) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if requesting user has permission (must be the team leader or admin)
    if (mainPerson._id.toString() !== user._id.toString() && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team leader or admin can send team emails.'
      });
    }

    // Get team members
    const teamMembers = await TeamMember.find({ mainPersonId: mainPerson._id });

    // Prepare team data for email service
    const teamData = {
      mainPerson: {
        name: mainPerson.name,
        email: mainPerson.email,
        events: mainPerson.events || []
      },
      teamMembers: teamMembers.map(member => ({
        name: member.name,
        email: member.email
      }))
    };

    // Prepare email content based on type
    let emailContent;
    if (emailType === 'registration') {
      emailContent = {
        subject: '🎉 Sabrang\'25 Team Registration Confirmed',
        // Additional content will be generated by the email service
      };
    } else {
      emailContent = {
        subject: '📧 Sabrang\'25 Team Update',
      };
    }

    // Send emails to all team members
    const emailResult = await sendEmailToAllTeamMembers(teamData, emailContent);

    if (emailResult.success) {
      res.json({
        success: true,
        message: `Emails sent successfully to team members`,
        summary: emailResult.summary,
        details: emailResult.results
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send emails to some or all team members',
        error: emailResult.error,
        details: emailResult.results
      });
    }

  } catch (error) {
    console.error('Error sending team emails:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;