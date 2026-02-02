const jwt = require('jsonwebtoken');
const OtpUser = require('../models/OtpUser');
const ErrorHandler = require('../utils/errorHandler');
const asyncErrorHandler = require('./asyncErrorHandler');

// User Authentication (JWT-based for OTP users)
exports.isAuthenticatedUser = asyncErrorHandler(async (req, res, next) => {

    let token;

    // Read token from Authorization header (Bearer token)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Fallback to cookies if no header token
    if (!token && req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return next(new ErrorHandler("Please Login to Access", 401));
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);

    // Extract userId with backward compatibility
    const userId = decodedData.userId || decodedData.id || decodedData._id;
    
    if (!userId) {
        return next(new ErrorHandler("Invalid token: missing user identifier", 401));
    }

    // Query OtpUser collection only
    const user = await OtpUser.findById(userId);

    if (!user) {
        return next(new ErrorHandler("User not found", 401));
    }

    // Attach user to request
    req.user = user;
    req.user.role = decodedData.role || 'customer';
    next();
});