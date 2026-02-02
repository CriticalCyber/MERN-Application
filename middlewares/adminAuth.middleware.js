const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/errorHandler');
const asyncErrorHandler = require('./asyncErrorHandler');

// Admin Authentication (Session-based)
exports.isAuthenticatedAdmin = asyncErrorHandler(async (req, res, next) => {
    // Check if admin is authenticated via session
    if (!req.session || !req.session.adminId) {
        return next(new ErrorHandler("Please Login to Access Admin Panel", 401));
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