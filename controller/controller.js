const { User, Event } = require("../models/models");
const shortid = require("shortid");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const qr = require("qr-image");

async function login(req, res) {
  const users = await User.findOne({ email: req.body.email ,password:req.body.password});
      if (!users) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }


  const token = jwt.sign({
    _id:users._id,
    email:users.email,
    referral:users.referalID
  },process.env.jwtkey)

  res.cookie("jwt",token,{
    httpOnly:true,
  })

  return res.status(200).json({
      success: true,
      message: 'Login successful',
    });


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

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    const referralID = shortid.generate();

    const newUser = await User.create({
      name: req.body.username,
      email: req.body.email,
      password: req.body.password, 
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
  { qrPath: `${newUser._id}` },  // Use forward slashes
  { new: true }  // Returns the updated document
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


module.exports = signup;

module.exports = { login,signup };
 