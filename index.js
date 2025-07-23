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

const app = express();

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// PORT - Fix: Use consistent variable name and ensure it's available early
const PORT = process.env.PORT || 8080;

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
    'https://sabrangselfbackend-production.up.railway.app'
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

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    mongoStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Health check endpoint - should respond quickly
app.get("/health", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    mongoStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Public routes (no authentication required)
app.post("/login", login);
app.post("/signup", signup);
app.post("/logout", logout);

// Protected routes (authentication required)
app.use("/api", apirouter);
app.use("/admin", adminrouter);

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

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Listening on 0.0.0.0:${PORT}`);
  console.log(`🗄️ MongoDB Connected: ${mongoose.connection.readyState === 1 ? 'Yes' : 'No'}`);
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