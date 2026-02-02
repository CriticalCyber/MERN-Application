const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
const ErrorHandler = require('../utils/errorHandler');

// Admin Authentication Middleware using sessions
const isAuthenticatedAdmin = async (req, res, next) => {
    // Check if admin is logged in via session
    if (!req.session || !req.session.adminId) {
        return next(new ErrorHandler("Please login to access this resource", 401));
    }

    // Validate if adminId is a valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.session.adminId)) {
        return next(new ErrorHandler("Invalid admin ID format", 401));
    }

    // Find admin from admin collection using session adminId
    const admin = await Admin.findById(req.session.adminId);

    if (!admin) {
        return next(new ErrorHandler("Admin not found", 401));
    }

    // Attach admin to request object
    req.admin = admin;
    next();
};

module.exports = isAuthenticatedAdmin;