const { User, Event } = require("../models/models");
const shortid = require("shortid");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const qr = require("qr-image");
const bcrypt = require("bcrypt");

async function login(req, res) {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign({
      _id: user._id,
      email: user.email,
      referral: user.referalID
    }, process.env.jwtkey);

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function signup(req, res) {
  try {
    console.log('Request Body:', req.body);

    if (!req.body.email || !req.body.password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check password strength (optional but recommended)
    if (req.body.password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    // Hash the password with bcrypt
    const saltRounds = 12; // Higher salt rounds for better security
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    const referralID = shortid.generate();

    const newUser = await User.create({
      name: req.body.username,
      email: req.body.email,
      password: hashedPassword, // Store the hashed password
      referalID: referralID,
    });

    const qrFilename = `${newUser._id}.png`;
    const qrPath = `public/qrcodes/${qrFilename}`;
    
    if (!fs.existsSync("public")) {
      fs.mkdirSync("public");
    }
    if (!fs.existsSync("public/qrcodes")) {
      fs.mkdirSync("public/qrcodes");
    }

    const qr_png = qr.image(`${newUser._id}`, { type: 'png' });
    const qrStream = fs.createWriteStream(qrPath);
    
    qr_png.pipe(qrStream);
    
    await new Promise((resolve, reject) => {
      qrStream.on('finish', resolve);
      qrStream.on('error', reject);
    });

    newUser.qrCode = qrFilename;
    await newUser.save();

    const qrupdate = await User.findOneAndUpdate(
      { _id: newUser._id },
      { qrPath: `${newUser._id}` },
      { new: true }
    );

    // Update referrer's count if referral code was provided
    if (req.body.referralCode) {
      await User.updateOne(
        { referalID: req.body.referralCode },
        { $inc: { referalcount: 1 } }
      );
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        email: newUser.email,
        referalID: newUser.referalID,
        referalCode: req.body.referralCode || null
      }
    });

  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function logout(req, res) {
  try {
    // Clear the JWT cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

module.exports = { login, signup, logout };