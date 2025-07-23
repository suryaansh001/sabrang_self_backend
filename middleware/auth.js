const jwt = require("jsonwebtoken");
const { User } = require("../models/models");

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const decoded = jwt.verify(token, process.env.jwtkey);
    
    // Fetch user data
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token."
    });
  }
};

// Middleware to verify admin access
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const decoded = jwt.verify(token, process.env.jwtkey);
    
    // Fetch user data
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found."
      });
    }

    // For now, allow all authenticated users to access admin routes
    // You can later add: if (!user.isAdmin) { return res.status(403)... }
    
    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token."
    });
  }
};

module.exports = { verifyToken, verifyAdmin };
