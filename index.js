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
const { User, TeamComposition } = require("./models/models");
const { generateUserQRCode } = require("./utils/qrCodeService");

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
    'https://sabrang.jklu.edu.in', 
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

// Serve QR codes from Railway volume in production, fallback to local in development
if (process.env.NODE_ENV === 'production') {
  app.use('/qrcodes', express.static('/app/qrcodes'));
  console.log('🗂️ Serving QR codes from Railway volume: /app/qrcodes');
} else {
  app.use('/qrcodes', express.static(path.join(__dirname, 'public/qrcodes')));
  console.log('🗂️ Serving QR codes from local directory: public/qrcodes');
}

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
    let flagshipBenefitsByEvent = null;
    let visitorPassDetails = null;
    let items = null;
    try { if (raw.formsBySignature) formsBySignature = JSON.parse(raw.formsBySignature); } catch (e) {}
    try { if (raw.teamMembersBySignature) teamMembersBySignature = JSON.parse(raw.teamMembersBySignature); } catch (e) {}
    try { if (raw.flagshipBenefitsByEvent) flagshipBenefitsByEvent = JSON.parse(raw.flagshipBenefitsByEvent); } catch (e) {}
    try { if (raw.visitorPassDetails) visitorPassDetails = JSON.parse(raw.visitorPassDetails); } catch (e) {}
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

    // Generate QR code as base64 for main person
    try {
      const qrCodeBase64 = await generateUserQRCode(mainPerson._id, {
        name: mainPerson.name,
        email: mainPerson.email
      });
      await User.findOneAndUpdate(
        { _id: mainPerson._id }, 
        { 
          qrPath: `${mainPerson._id}`, // Keep for backward compatibility
          qrCodeBase64: qrCodeBase64 
        }, 
        { new: true }
      );
      console.log(`✅ QR code generated as base64 for main person: ${mainPerson._id}`);
    } catch (qrError) {
      console.error('❌ QR code generation failed for main person:', qrError);
    }

    // Process team members using unified User schema
    const createdTeamMembers = [];
    for (let i = 0; i < teamMembersBySigArray.length; i++) {
      const { member, signature, index } = teamMembersBySigArray[i];
      const memberImage = (memberImageMap[signature] && memberImageMap[signature][index]) ? memberImageMap[signature][index] : null;

      // Derive email similar to main person logic
      const memberEmail = member.email || member.collegeMailId || '';
      const memberName = member.name || 'Team Member';

      if (!memberEmail) {
        console.warn(`⚠️ Skipping team member without email: ${memberName}`);
        continue;
      }

      // Check if team member already exists as a User
      let teamMemberUser = await User.findOne({ email: memberEmail });

      const memberPayload = {
        name: memberName,
        email: memberEmail,
        contactNo: member.contactNo || "",
        gender: member.gender || "",
        age: member.age ? Number(member.age) : null,
        universityName: member.universityName || mainPersonUniversity,
        address: member.address || mainPersonAddress,
        profileImage: memberImage || "",
        events: mainPerson.events || [],
        isvalidated: true
      };

      if (!teamMemberUser) {
        // Create new team member as User
        const memberPassword = Math.random().toString(36).slice(-10) + 'A1!';
        const memberHashedPassword = await bcrypt.hash(memberPassword, 12);
        
        teamMemberUser = new User({
          ...memberPayload,
          password: memberHashedPassword
        });
        await teamMemberUser.save();
        console.log(`✅ Created new team member user: ${memberName} (${memberEmail})`);
      } else {
        // Update existing team member user - add events
        if (Array.isArray(memberPayload.events) && Array.isArray(teamMemberUser.events)) {
          memberPayload.events = Array.from(new Set([...(teamMemberUser.events || []), ...memberPayload.events]));
        }
        teamMemberUser = await User.findByIdAndUpdate(teamMemberUser._id, memberPayload, { new: true });
        console.log(`✅ Updated existing team member user: ${memberName} (${memberEmail})`);
      }

      // Generate QR code as base64 for team member
      try {
        const memberQrCodeBase64 = await generateUserQRCode(teamMemberUser._id, {
          name: teamMemberUser.name,
          email: teamMemberUser.email
        });
        await User.findOneAndUpdate(
          { _id: teamMemberUser._id }, 
          { 
            qrPath: `${teamMemberUser._id}`, // Keep for backward compatibility
            qrCodeBase64: memberQrCodeBase64 
          }, 
          { new: true }
        );
        console.log(`✅ QR code generated as base64 for team member: ${teamMemberUser._id}`);
      } catch (memberQrError) {
        console.error(`❌ QR code generation failed for team member ${teamMemberUser.name}:`, memberQrError);
      }

      createdTeamMembers.push(teamMemberUser);
    }

    // Process visitor pass registration (standalone)
    const createdVisitors = [];
    const visitorPassDays = parseInt(raw.visitorPassDays || '0', 10);
    if (visitorPassDays > 0 && visitorPassDetails) {
      const visitorEmail = visitorPassDetails.collegeMailId || '';
      const visitorName = visitorPassDetails.name || 'Visitor';

      if (visitorEmail) {
        let visitorUser = await User.findOne({ email: visitorEmail });

        const visitorPayload = {
          name: visitorName,
          email: visitorEmail,
          contactNo: visitorPassDetails.contactNo || "",
          gender: visitorPassDetails.gender || "",
          age: visitorPassDetails.age ? Number(visitorPassDetails.age) : null,
          universityName: visitorPassDetails.universityName || "",
          address: visitorPassDetails.address || "",
          userType: 'participant',
          events: ['VISITOR_PASS'],
          visitorPassDays: visitorPassDays,
          isvalidated: true
        };

        if (!visitorUser) {
          const visitorPassword = Math.random().toString(36).slice(-10) + 'A1!';
          const visitorHashedPassword = await bcrypt.hash(visitorPassword, 12);
          
          visitorUser = new User({
            ...visitorPayload,
            password: visitorHashedPassword
          });
          await visitorUser.save();
          console.log(`✅ Created visitor user: ${visitorName} (${visitorEmail}) - ${visitorPassDays} days`);
        } else {
          visitorUser = await User.findByIdAndUpdate(visitorUser._id, visitorPayload, { new: true });
          console.log(`✅ Updated visitor user: ${visitorName} (${visitorEmail}) - ${visitorPassDays} days`);
        }

        // Generate QR code for visitor
        try {
          const visitorQrCodeBase64 = await generateUserQRCode(visitorUser._id, {
            name: visitorUser.name,
            email: visitorUser.email
          });
          await User.findOneAndUpdate(
            { _id: visitorUser._id }, 
            { 
              qrPath: `${visitorUser._id}`,
              qrCodeBase64: visitorQrCodeBase64 
            }, 
            { new: true }
          );
          console.log(`✅ QR code generated for visitor: ${visitorUser._id}`);
        } catch (visitorQrError) {
          console.error(`❌ QR code generation failed for visitor ${visitorUser.name}:`, visitorQrError);
        }

        createdVisitors.push(visitorUser);
      }
    }

    // Process support staff and flagship benefits
    const createdSupportStaff = [];
    const createdFlagshipVisitors = [];
    if (flagshipBenefitsByEvent && typeof flagshipBenefitsByEvent === 'object') {
      for (const [eventId, benefits] of Object.entries(flagshipBenefitsByEvent)) {
        const eventName = items?.find(item => item.id === parseInt(eventId))?.title || `Event_${eventId}`;
        
        // Process support artists
        if (benefits.supportArtistDetails && Array.isArray(benefits.supportArtistDetails)) {
          for (const supportArtist of benefits.supportArtistDetails) {
            const supportEmail = supportArtist.email || '';
            const supportName = supportArtist.name || 'Support Staff';
            const supportRole = supportArtist.role || 'support';

            if (supportEmail) {
              let supportUser = await User.findOne({ email: supportEmail });

              const supportPayload = {
                name: supportName,
                email: supportEmail,
                contactNo: supportArtist.contactNo || "",
                userType: 'support_staff',
                supportRole: supportRole,
                governmentId: supportArtist.idNumber || "",
                idType: supportArtist.idType || "",
                events: [eventName],
                isvalidated: true
              };

              if (!supportUser) {
                const supportPassword = Math.random().toString(36).slice(-10) + 'A1!';
                const supportHashedPassword = await bcrypt.hash(supportPassword, 12);
                
                supportUser = new User({
                  ...supportPayload,
                  password: supportHashedPassword
                });
                await supportUser.save();
                console.log(`✅ Created support staff user: ${supportName} (${supportEmail}) - ${supportRole} for ${eventName}`);
              } else {
                // Add new event to existing support staff
                if (Array.isArray(supportUser.events)) {
                  supportPayload.events = Array.from(new Set([...supportUser.events, eventName]));
                }
                supportUser = await User.findByIdAndUpdate(supportUser._id, supportPayload, { new: true });
                console.log(`✅ Updated support staff user: ${supportName} (${supportEmail}) - ${supportRole} for ${eventName}`);
              }

              // Generate QR code for support staff
              try {
                const supportQrCodeBase64 = await generateUserQRCode(supportUser._id, {
                  name: supportUser.name,
                  email: supportUser.email
                });
                await User.findOneAndUpdate(
                  { _id: supportUser._id }, 
                  { 
                    qrPath: `${supportUser._id}`,
                    qrCodeBase64: supportQrCodeBase64 
                  }, 
                  { new: true }
                );
                console.log(`✅ QR code generated for support staff: ${supportUser._id}`);
              } catch (supportQrError) {
                console.error(`❌ QR code generation failed for support staff ${supportUser.name}:`, supportQrError);
              }

              createdSupportStaff.push({
                userId: supportUser._id,
                name: supportUser.name,
                email: supportUser.email,
                role: supportRole,
                eventName: eventName,
                hasEntered: false,
                entryTime: null
              });
            }
          }
        }

        // Process flagship visitor passes
        if (benefits.flagshipVisitorPassDetails && Array.isArray(benefits.flagshipVisitorPassDetails)) {
          for (const flagshipVisitor of benefits.flagshipVisitorPassDetails) {
            const visitorEmail = flagshipVisitor.collegeMailId || '';
            const visitorName = flagshipVisitor.name || 'Flagship Visitor';

            if (visitorEmail) {
              let visitorUser = await User.findOne({ email: visitorEmail });

              const visitorPayload = {
                name: visitorName,
                email: visitorEmail,
                contactNo: flagshipVisitor.contactNo || "",
                gender: flagshipVisitor.gender || "",
                age: flagshipVisitor.age ? Number(flagshipVisitor.age) : null,
                universityName: flagshipVisitor.universityName || "",
                address: flagshipVisitor.address || "",
                userType: 'flagship_visitor',
                events: [eventName],
                isvalidated: true
              };

              if (!visitorUser) {
                const visitorPassword = Math.random().toString(36).slice(-10) + 'A1!';
                const visitorHashedPassword = await bcrypt.hash(visitorPassword, 12);
                
                visitorUser = new User({
                  ...visitorPayload,
                  password: visitorHashedPassword
                });
                await visitorUser.save();
                console.log(`✅ Created flagship visitor user: ${visitorName} (${visitorEmail}) for ${eventName}`);
              } else {
                // Add new event to existing visitor
                if (Array.isArray(visitorUser.events)) {
                  visitorPayload.events = Array.from(new Set([...visitorUser.events, eventName]));
                }
                visitorUser = await User.findByIdAndUpdate(visitorUser._id, visitorPayload, { new: true });
                console.log(`✅ Updated flagship visitor user: ${visitorName} (${visitorEmail}) for ${eventName}`);
              }

              // Generate QR code for flagship visitor
              try {
                const visitorQrCodeBase64 = await generateUserQRCode(visitorUser._id, {
                  name: visitorUser.name,
                  email: visitorUser.email
                });
                await User.findOneAndUpdate(
                  { _id: visitorUser._id }, 
                  { 
                    qrPath: `${visitorUser._id}`,
                    qrCodeBase64: visitorQrCodeBase64 
                  }, 
                  { new: true }
                );
                console.log(`✅ QR code generated for flagship visitor: ${visitorUser._id}`);
              } catch (visitorQrError) {
                console.error(`❌ QR code generation failed for flagship visitor ${visitorUser.name}:`, visitorQrError);
              }

              createdFlagshipVisitors.push({
                userId: visitorUser._id,
                name: visitorUser.name,
                email: visitorUser.email,
                role: 'flagship_visitor',
                eventName: eventName,
                hasEntered: false,
                entryTime: null
              });
            }
          }
        }

        // Process flagship solo visitor passes
        if (benefits.flagshipSoloVisitorPassDetails && Array.isArray(benefits.flagshipSoloVisitorPassDetails)) {
          for (const flagshipSoloVisitor of benefits.flagshipSoloVisitorPassDetails) {
            const soloVisitorEmail = flagshipSoloVisitor.collegeMailId || '';
            const soloVisitorName = flagshipSoloVisitor.name || 'Flagship Solo Visitor';

            if (soloVisitorEmail) {
              let soloVisitorUser = await User.findOne({ email: soloVisitorEmail });

              const soloVisitorPayload = {
                name: soloVisitorName,
                email: soloVisitorEmail,
                contactNo: flagshipSoloVisitor.contactNo || "",
                gender: flagshipSoloVisitor.gender || "",
                age: flagshipSoloVisitor.age ? Number(flagshipSoloVisitor.age) : null,
                universityName: flagshipSoloVisitor.universityName || "",
                address: flagshipSoloVisitor.address || "",
                userType: 'flagship_solo_visitor',
                events: [eventName],
                isvalidated: true
              };

              if (!soloVisitorUser) {
                const soloVisitorPassword = Math.random().toString(36).slice(-10) + 'A1!';
                const soloVisitorHashedPassword = await bcrypt.hash(soloVisitorPassword, 12);
                
                soloVisitorUser = new User({
                  ...soloVisitorPayload,
                  password: soloVisitorHashedPassword
                });
                await soloVisitorUser.save();
                console.log(`✅ Created flagship solo visitor user: ${soloVisitorName} (${soloVisitorEmail}) for ${eventName}`);
              } else {
                // Add new event to existing solo visitor
                if (Array.isArray(soloVisitorUser.events)) {
                  soloVisitorPayload.events = Array.from(new Set([...soloVisitorUser.events, eventName]));
                }
                soloVisitorUser = await User.findByIdAndUpdate(soloVisitorUser._id, soloVisitorPayload, { new: true });
                console.log(`✅ Updated flagship solo visitor user: ${soloVisitorName} (${soloVisitorEmail}) for ${eventName}`);
              }

              // Generate QR code for flagship solo visitor
              try {
                const soloVisitorQrCodeBase64 = await generateUserQRCode(soloVisitorUser._id, {
                  name: soloVisitorUser.name,
                  email: soloVisitorUser.email
                });
                await User.findOneAndUpdate(
                  { _id: soloVisitorUser._id }, 
                  { 
                    qrPath: `${soloVisitorUser._id}`,
                    qrCodeBase64: soloVisitorQrCodeBase64 
                  }, 
                  { new: true }
                );
                console.log(`✅ QR code generated for flagship solo visitor: ${soloVisitorUser._id}`);
              } catch (soloVisitorQrError) {
                console.error(`❌ QR code generation failed for flagship solo visitor ${soloVisitorUser.name}:`, soloVisitorQrError);
              }

              createdFlagshipVisitors.push({
                userId: soloVisitorUser._id,
                name: soloVisitorUser.name,
                email: soloVisitorUser.email,
                role: 'flagship_solo_visitor',
                eventName: eventName,
                hasEntered: false,
                entryTime: null
              });
            }
          }
        }
      }
    }

    // Create TeamComposition records for team events (if there are team members, support staff, or flagship visitors)
    const teamCompositions = [];
    const allTeamRelatedMembers = [...createdTeamMembers, ...createdSupportStaff, ...createdFlagshipVisitors];
    
    if ((createdTeamMembers.length > 0 || createdSupportStaff.length > 0 || createdFlagshipVisitors.length > 0) && Array.isArray(mainPerson.events)) {
      console.log(`🏆 Creating team compositions for ${mainPerson.events.length} events`);
      console.log(`👥 Total members: ${createdTeamMembers.length} team members, ${createdSupportStaff.length} support staff, ${createdFlagshipVisitors.length} flagship visitors`);
      
      for (const eventName of mainPerson.events) {
        // Filter members for this specific event
        const eventSupportStaff = createdSupportStaff.filter(staff => staff.eventName === eventName);
        const eventFlagshipVisitors = createdFlagshipVisitors.filter(visitor => visitor.eventName === eventName);
        const allEventMembers = [...createdTeamMembers, ...eventSupportStaff, ...eventFlagshipVisitors];
        
        // Debug: Check all members have valid userId
        console.log(`🔍 Debug - Event ${eventName} members:`, allEventMembers.map(m => ({ 
          name: m.name, 
          email: m.email, 
          userId: m.userId, 
          userIdType: typeof m.userId,
          role: m.role 
        })));
        
        if (allEventMembers.length > 0) {
          // Validate all members have userId
          const membersWithoutUserId = allEventMembers.filter(member => !member.userId);
          if (membersWithoutUserId.length > 0) {
            console.error(`❌ Found ${membersWithoutUserId.length} members without userId:`, membersWithoutUserId);
            console.error(`Full member details:`, JSON.stringify(membersWithoutUserId, null, 2));
            throw new Error(`Invalid team members: ${membersWithoutUserId.length} members missing userId`);
          }
          
          // Additional validation: ensure all userIds are valid ObjectIds
          const membersWithInvalidUserId = allEventMembers.filter(member => {
            try {
              return !mongoose.Types.ObjectId.isValid(member.userId);
            } catch (e) {
              return true;
            }
          });
          
          if (membersWithInvalidUserId.length > 0) {
            console.error(`❌ Found ${membersWithInvalidUserId.length} members with invalid userId:`, membersWithInvalidUserId);
            throw new Error(`Invalid team members: ${membersWithInvalidUserId.length} members have invalid userId format`);
          }
          
          // Generate unique team ID
          const teamId = `TEAM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          console.log(`🏅 Creating team composition for event: ${eventName} with ${allEventMembers.length} total members`);
          const teamComposition = new TeamComposition({
            eventName: eventName,
            teamName: `${mainPerson.name}'s Team`,
            teamId: teamId,
            teamLeader: {
              userId: mainPerson._id,
              name: mainPerson.name,
              email: mainPerson.email,
              hasEntered: false
            },
            teamMembers: allEventMembers.map(member => {
              console.log(`🔍 Mapping member:`, { name: member.name, userId: member.userId, type: typeof member.userId });
              return {
                userId: member.userId,
                name: member.name,
                email: member.email,
                hasEntered: false,
                role: member.role || 'member'
              };
            }),
            totalMembers: allEventMembers.length + 1, // +1 for team leader
            registrationComplete: true,
            paymentStatus: 'pending', // Will be updated after payment
            createdAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          await teamComposition.save();
          teamCompositions.push(teamComposition);
          console.log(`✅ Team composition created for ${eventName}: ${teamId} (${allEventMembers.length} members + 1 leader)`);
        }
      }
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
        supportStaff: createdSupportStaff,
        flagshipVisitors: createdFlagshipVisitors,
        visitors: createdVisitors.map(visitor => ({
          id: visitor._id,
          name: visitor.name,
          email: visitor.email,
          contactNo: visitor.contactNo,
          visitorPassDays: visitor.visitorPassDays,
          qrPath: visitor.qrPath
        })),
        teamCompositions: teamCompositions.map(tc => ({
          id: tc._id,
          eventName: tc.eventName,
          teamName: tc.teamName,
          teamId: tc.teamId,
          totalMembers: tc.totalMembers
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

// New direct payment router with unified schema support
const directPaymentRouter = require("./routes/direct_payment_new");
app.use("/api/direct-payment", directPaymentRouter);


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
      
      // Generate QR code as base64 for the new user
      try {
        const qrCodeBase64 = await generateUserQRCode(user._id, {
          name: user.name,
          email: user.email
        });
        
        // Update user with QR code data
        await User.findOneAndUpdate(
          { _id: user._id },
          { 
            qrPath: `${user._id}`, // Keep for backward compatibility
            qrCodeBase64: qrCodeBase64 
          },
          { new: true }
        );
        console.log(`✅ QR code generated as base64 for new user: ${user._id}`);
      } catch (qrError) {
        console.error('❌ QR code generation failed for new user:', qrError);
      }
      
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
