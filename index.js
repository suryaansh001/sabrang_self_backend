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

// Connect to MongoDB
mongoose.connect(process.env.mongodb)
  .then(() => console.log("Database Connected Successfully"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Middleware
app.use(cookieparser());

app.use(cors({
  origin: ['https://sabrang25-first-draft.vercel.app/', 'http://localhost:3000'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.get("/", (req, res) => {
  res.send("API Server is running");
});

// Public routes (no authentication required)
app.post("/login", login);
app.post("/signup", signup);
app.post("/logout", logout);

// Protected routes (authentication required)
app.use("/api", apirouter);
app.use("/admin", adminrouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});