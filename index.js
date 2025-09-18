require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require('body-parser');
const { login, signup, logout } = require("./controller/controller");
const apirouter = require("./routes/api");
const cookieparser = require("cookie-parser");
const adminrouter = require("./routes/admin");
const path = require('path');
const jwt = require("jsonwebtoken");
const shortid = require("shortid"); // Add this line
const multer = require("multer");
const fs = require("fs");
const bcrypt = require("bcrypt");
const { User, TeamMember } = require("./models/models");

const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB with better error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.mongodb, {
      // Add these options for better connection handling
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("Database Connected Successfully");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    // Don't exit the process, let the app start even if DB connection fails initially
    // This allows Railway to detect the app is running
  }
};

// Connect to database
connectDB();

// Middleware
app.use(cookieparser());

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// CORS configuration
app.use(cors({
  origin: [
    'https://sabrang25-first-draft.vercel.app', 
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://sabrang.jklu.edu.in'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  optionsSuccessStatus: 200
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public', 'profile');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate safe, short filename (Windows-safe: avoid special chars/length from fieldname)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname || '') || '.png';
    // Use a compact base derived from fieldname, but sanitized and truncated
    const baseFromField = (file.fieldname || 'upload')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 24) || 'upload';
    const prefix = baseFromField.startsWith('memberImage') ? 'memberImage' : (baseFromField || 'upload');
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Routes - Add extensive logging
app.get("/", (req, res) => {
  console.log(`📥 Root route accessed - ${req.method} ${req.path}`);
  console.log(`📡 Headers:`, req.headers);
  console.log(`🌐 IP:`, req.ip);
  console.log(`🔗 Protocol:`, req.protocol);
  
  const response = {
    message: "API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    mongoStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    serverInfo: {
      uptime: process.uptime(),
      pid: process.pid,
      platform: process.platform,
      version: process.version
    }
  };
  
  console.log(`📤 Sending response:`, response);
  res.json(response);
});

// Health check endpoint - should respond quickly
app.get("/health", (req, res) => {
  console.log(`📥 Health check accessed - ${req.method} ${req.path}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  const response = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    mongoStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  };
  console.log(`📤 Health response:`, response);
  res.json(response);
});

// Add a simple test route
app.get("/ping", (req, res) => {
  console.log(`📥 Ping accessed - ${req.method} ${req.path}`);
  res.send("pong");
});

// Public routes (no authentication required)
app.post("/login", (req, res, next) => {
  console.log(`📥 Login attempt from: ${req.get('Origin')}`);
  console.log(`📝 Login data:`, { email: req.body.email, hasPassword: !!req.body.password });
  next();
}, login);

app.post("/signup", (req, res, next) => {
  console.log(`📥 Signup attempt from: ${req.get('Origin')}`);
  console.log(`📝 Signup data:`, { 
    email: req.body.email, 
    username: req.body.username,
    hasPassword: !!req.body.password 
  });
  next();
}, signup);

app.post("/logout", logout);

// Register route with image upload - NEW TEAM-BASED SYSTEM
app.post("/register", upload.any(), async (req, res) => {
  try {
    console.log("V3 register ran - Team-based system");
    const raw = req.body || {};

    // Parse complex payloads
    let formsBySignature = null;
    let teamMembersBySignature = null;
    let items = null;
    try { if (raw.formsBySignature) formsBySignature = JSON.parse(raw.formsBySignature); } catch (e) {}
    try { if (raw.teamMembersBySignature) teamMembersBySignature = JSON.parse(raw.teamMembersBySignature); } catch (e) {}
    try { if (raw.items) items = JSON.parse(raw.items); } catch (e) {}

    // Merge all group fields to a single flat map to simplify lookups
    const mergedFormFields = (() => {
      const acc = {};
      if (formsBySignature && typeof formsBySignature === 'object') {
        for (const key of Object.keys(formsBySignature)) {
          const group = formsBySignature[key] || {};
          Object.assign(acc, group);
        }
      }
      return acc;
    })();

    const deriveFromForms = (field) => mergedFormFields[field];

    // Main person details
    let mainPersonName = raw.name || deriveFromForms('name');
    let mainPersonEmail = raw.email || raw.collegeMailId || deriveFromForms('collegeMailId');
    let password = raw.password;

    const mainPersonContactNo = raw.contactNo || deriveFromForms('contactNo') || "";
    const mainPersonGender = raw.gender || deriveFromForms('gender') || "";
    const mainPersonAge = raw.age ? Number(raw.age) : (deriveFromForms('age') ? Number(deriveFromForms('age')) : null);
    const mainPersonUniversity = raw.universityName || deriveFromForms('universityName') || "";
    const mainPersonAddress = raw.address || deriveFromForms('address') || "";

    if (!mainPersonEmail) {
      return res.status(400).json({ success: false, message: 'Main person email is required' });
    }
    if (!mainPersonName) mainPersonName = 'Team Leader';

    // Check if main person already exists
    let mainPerson = await User.findOne({ email: mainPersonEmail });

    if (!password) password = Math.random().toString(36).slice(-10) + 'A1!';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Removed teamId field from User

    // Process team members data but preserve signature and index for image mapping
    const teamMembersBySigArray = [];
    if (teamMembersBySignature && typeof teamMembersBySignature === 'object') {
      for (const sig of Object.keys(teamMembersBySignature)) {
        const members = Array.isArray(teamMembersBySignature[sig]) ? teamMembersBySignature[sig] : [];
        members.forEach((member, idx) => {
          teamMembersBySigArray.push({ member, signature: sig, index: idx });
        });
      }
    }

    // Attach team member images if uploaded
    const memberImageMap = {};
    const filesArray = Array.isArray(req.files) ? req.files : [];
    for (const f of filesArray) {
      if (!f || !f.fieldname) continue;
      const m = f.fieldname.match(/^memberImage__([^_].*?)__(\d+)$/);
      if (m) {
        const encodedSig = m[1];
        let sig;
        try { sig = decodeURIComponent(encodedSig); } catch { sig = encodedSig; }
        const idx = parseInt(m[2], 10);
        const url = `/public/profile/${f.filename}`;
        memberImageMap[sig] = memberImageMap[sig] || {};
        memberImageMap[sig][idx] = url;
      }
    }

    // Create or update main person
    const mainPersonPayload = {
      name: mainPersonName,
      email: mainPersonEmail,
      contactNo: mainPersonContactNo,
      gender: mainPersonGender,
      age: mainPersonAge,
      universityName: mainPersonUniversity,
      address: mainPersonAddress,
      isMainPerson: true,
      teamSize: teamMembersBySigArray.length + 1, // +1 for main person
      
    };

    // Add profile image for main person
    if (Array.isArray(req.files)) {
      const pf = req.files.find(f => f.fieldname === 'profileImage');
      if (pf) mainPersonPayload.profileImage = `/public/profile/${pf.filename}`;
    }

    // Add events for main person
    if (Array.isArray(items)) {
      const eventNames = items.map(it => it.title).filter(Boolean);
      if (eventNames.length) mainPersonPayload.events = eventNames;
    }

    if (!mainPerson) {
      mainPerson = new User({
        ...mainPersonPayload,
        password: hashedPassword,
        
      });
      await mainPerson.save();
    } else {
      if (raw.password) mainPersonPayload.password = hashedPassword;
      if (Array.isArray(mainPersonPayload.events) && Array.isArray(mainPerson.events)) {
        mainPersonPayload.events = Array.from(new Set([...(mainPerson.events || []), ...mainPersonPayload.events]));
      }
      mainPerson = await User.findByIdAndUpdate(mainPerson._id, mainPersonPayload, { new: true });
    }

    // Generate QR code for main person
    const qr = require('qr-image');
    const mainPersonQrFilename = `${mainPerson._id}.png`;
    const mainPersonQrPath = `public/qrcodes/${mainPersonQrFilename}`;
    if (!fs.existsSync("public/qrcodes")) fs.mkdirSync("public/qrcodes", { recursive: true });
    if (!fs.existsSync(mainPersonQrPath)) {
      const qr_png = qr.image(`${mainPerson._id}`, { type: 'png' });
      const qrStream = fs.createWriteStream(mainPersonQrPath);
      qr_png.pipe(qrStream);
      await new Promise((resolve, reject) => {
        qrStream.on('finish', resolve);
        qrStream.on('error', reject);
      });
    }
    await User.findOneAndUpdate({ _id: mainPerson._id }, { qrPath: `${mainPerson._id}` }, { new: true });

    // Process team members
    const createdTeamMembers = [];
    for (let i = 0; i < teamMembersBySigArray.length; i++) {
      const { member, signature, index } = teamMembersBySigArray[i];
      const memberImage = (memberImageMap[signature] && memberImageMap[signature][index]) ? memberImageMap[signature][index] : null;

      // Derive email similar to main person logic
      const memberEmail = member.email || member.collegeMailId || '';

      const teamMember = new TeamMember({
        mainPersonId: mainPerson._id,
        name: member.name || 'Team Member',
        email: memberEmail || `${(member.name || 'member')?.toLowerCase().replace(/\s+/g, '')}@team.local`,
        contactNo: member.contactNo || "",
        gender: member.gender || "",
        age: member.age ? Number(member.age) : null,
        universityName: member.universityName || mainPersonUniversity,
        address: member.address || mainPersonAddress,
        profileImage: memberImage || "",
        events: mainPerson.events || []
      });

      await teamMember.save();

      // Generate QR code for team member based on saved _id
      const memberQrFilename = `${teamMember._id}.png`;
      const memberQrPath = `public/qrcodes/${memberQrFilename}`;
      const qr_png_member = qr.image(`${teamMember._id}`, { type: 'png' });
      const qrStreamMember = fs.createWriteStream(memberQrPath);
      qr_png_member.pipe(qrStreamMember);
      await new Promise((resolve, reject) => {
        qrStreamMember.on('finish', resolve);
        qrStreamMember.on('error', reject);
      });
      teamMember.qrPath = `${teamMember._id}`;
      await teamMember.save();

      createdTeamMembers.push(teamMember);
    }

    res.status(201).json({
      success: true,
      message: "Team registered successfully",
      team: {
        mainPerson: {
          id: mainPerson._id,
          name: mainPerson.name,
          email: mainPerson.email,
          profileImage: mainPerson.profileImage,
          qrPath: mainPerson.qrPath,
          contactNo: mainPerson.contactNo,
          gender: mainPerson.gender,
          age: mainPerson.age,
          universityName: mainPerson.universityName,
          address: mainPerson.address,
          events: mainPerson.events || [],
        },
        teamMembers: createdTeamMembers.map(member => ({
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
          events: member.events
        })),
        teamSize: mainPerson.teamSize
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Protected routes (authentication required)
app.use("/api", apirouter);
app.use("/admin", adminrouter);

// Payment routes
const paymentRouter = require("./routes/cashfree_simple");
app.use("/api/payments", paymentRouter);

// Advanced payment router: saves registrations after successful payment
const advancedPaymentRouter = require("./routes/payment");
app.use("/api/payment", advancedPaymentRouter);


//GOOGLE AUTHENTICATION 
const passport = require("passport");
const session = require("express-session");
const { access } = require("fs"); 
const GoogleStrategy = require("passport-google-oauth20").Strategy;

app.use(session({
secret:"ayush",
resave:false,
saveUninitialized:true,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID:process.env.client,
  clientSecret:process.env.clientsecret,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback'
},async (accessToken, refreshToken, profile, done) => {
  try {
    // Find existing user
    let user = await User.findOne({ email: profile.emails[0].value });
    
    if (!user) {
      // Import shortid at the top of the file if not already imported
      const shortid = require("shortid");
      
      // Generate referral ID
      const referralID = shortid.generate();
      
      // Create new user if doesn't exist
      user = new User({
        email: profile.emails[0].value,
        name: profile.displayName,
        referalID: referralID, // Add referral ID
      });
      await user.save();
      
      // Generate QR code for the new user
      const fs = require('fs');
      const qr = require('qr-image');
      
      const qrFilename = `${user._id}.png`;
      const qrPath = `public/qrcodes/${qrFilename}`;
      
      // Create directories if they don't exist
      if (!fs.existsSync("public")) {
        fs.mkdirSync("public");
      }
      if (!fs.existsSync("public/qrcodes")) {
        fs.mkdirSync("public/qrcodes");
      }
      
      // Generate and save QR code
      const qr_png = qr.image(`${user._id}`, { type: 'png' });
      const qrStream = fs.createWriteStream(qrPath);
      
      qr_png.pipe(qrStream);
      
      await new Promise((resolve, reject) => {
        qrStream.on('finish', resolve);
        qrStream.on('error', reject);
      });
      
      // Update user with QR path
      await User.findOneAndUpdate(
        { _id: user._id },
        { qrPath: `${user._id}` },
        { new: true }
      );
      
      console.log('New user created with QR code:', user);
    }
    
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user,done)=>done(null,user));
passport.deserializeUser((user,done)=>done(null,user));

app.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));

app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false
  }),
  async (req, res) => {
    try {
      // Generate JWT token with user data
      const token = jwt.sign(
        {
          _id: req.user._id, // Changed from id to _id to match verification middleware
          email: req.user.email,
          name: req.user.name
        },
        process.env.jwtkey,
        { expiresIn: '1d' }
      );
      
      // Determine environment to set cookie options appropriately
      const isProduction = process.env.NODE_ENV === 'production';
      const isLocalFrontend = (process.env.frontendurl || '').includes('localhost');
      
      // Set the token as an HTTP-only cookie
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction && !isLocalFrontend ? true : false,
        sameSite: isProduction && !isLocalFrontend ? 'none' : 'lax',
        domain: isProduction && process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      };
      console.log('Setting jwt cookie with options:', cookieOptions);
      res.cookie('jwt', token, cookieOptions);
      // Redirect to frontend with token
      res.redirect(`${process.env.frontendurl}/auth/callback?token=${token}`);
    } catch (err) {
      // Handle error
    }
  });

app.get("/success",(req,res)=>{
  res.send(`Welcome ${req.user.displayName}`)
})










// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  // Handle other errors
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed"
    });
  }
  
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Debug: Log all environment variables related to networking
console.log('🔍 Environment Debug:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars:', Object.keys(process.env).filter(key => 
  key.includes('PORT') || key.includes('HOST') || key.includes('RAILWAY')
).reduce((obj, key) => {
  obj[key] = process.env[key];
  return obj;
}, {}));

// Start server with additional error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Listening on 0.0.0.0:${PORT}`);
  console.log(`🗄️ MongoDB Connected: ${mongoose.connection.readyState === 1 ? 'Yes' : 'No'}`);
  console.log(`✅ Server ready to accept connections`);
  
  // Get the actual address the server is listening on
  const address = server.address();
  console.log(`🎯 Server address:`, address);
  
  // Test that routes are working
  console.log('🧪 Testing server responsiveness...');
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
