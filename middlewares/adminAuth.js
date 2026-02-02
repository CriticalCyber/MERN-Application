const mongoose = require("mongoose");
const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/errorHandler');
const asyncErrorHandler = require('./asyncErrorHandler');

// Session-based Admin Authentication Middleware
const isAuthenticatedAdmin = asyncErrorHandler(async (req, res, next) => {
  // ✅ SECURITY GUARD: Reject JWT tokens on admin routes
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return next(new ErrorHandler("JWT token not allowed on admin routes", 403));
  }

  // Check if admin is authenticated via session
  if (!req.session || !req.session.adminId) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  // Validate if adminId is a valid ObjectId format
  if (!mongoose.Types.ObjectId.isValid(req.session.adminId)) {
    return next(new ErrorHandler("Invalid admin ID format", 401));
  }

  // Find admin by ID stored in session
  const admin = await Admin.findById(req.session.adminId);

  if (!admin) {
    return next(new ErrorHandler("Admin not found", 401));
  }

  req.admin = admin;
  next();
});

module.exports = isAuthenticatedAdmin;