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

// Protected routes (authentication required)
app.use("/api", apirouter);
app.use("/admin", adminrouter);


//GOOGLE AUTHENTICATION 
const passport = require("passport");
const session = require("express-session");
const { access } = require("fs");
const { User } = require("./models/models");
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
      // Import shortid at the top of the filegoogle-oauth20").Strategy; if not already imported
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
