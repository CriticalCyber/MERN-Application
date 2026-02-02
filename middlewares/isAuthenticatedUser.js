const jwt = require('jsonwebtoken');
const User = require('../models/OtpUser');
const ErrorHandler = require('../utils/errorHandler');

// User Authentication Middleware using JWT tokens
const isAuthenticatedUser = async (req, res, next) => {
    try {
        let token;

        // Extract token from Authorization header (Bearer token)
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
            return res.status(401).json({
                success: false,
                message: "Please login to access this resource"
            });
        }

        // Verify and decode JWT token
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user by ID from token payload
        const user = await User.findById(decodedData._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        // Attach user to request object
        req.user = user;
        next();
        
    } catch (error) {
        // Handle JWT verification errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Token expired"
            });
        }
        
        // For any other error, pass to error handler
        return res.status(401).json({
            success: false,
            message: "Authentication failed"
        });
    }
};

module.exports = isAuthenticatedUser;