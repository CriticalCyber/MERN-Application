const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// General API rate limiter (100 requests per 15 minutes)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints (5 requests per 15 minutes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many authentication attempts from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP request rate limiter (1 request per phone number every 60 seconds)
const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1, // limit each phone number to 1 request per windowMs
    message: {
        success: false,
        message: 'Please wait before requesting another OTP.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip failed requests to allow retries for legitimate users
    skipFailedRequests: true,
    // Custom key generator to rate limit by phone number instead of IP
    keyGenerator: function (req) {
        // Extract phone number from request body
        const phoneNumber = req.body.phoneNumber;
        // If phone number is provided, use it as the rate limit key
        if (phoneNumber) {
            return phoneNumber;
        }
        // Fallback to IP-based rate limiting if no phone number
        // Use ipKeyGenerator helper for IPv6 compatibility
        return ipKeyGenerator(req);
    }
});

// Payment rate limiter (3 requests per 15 minutes)
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // limit each IP to 3 requests per windowMs
    message: {
        success: false,
        message: 'Too many payment attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Order creation rate limiter (2 requests per hour per user)
const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // limit each user to 2 requests per windowMs
    message: {
        success: false,
        message: 'Too many order attempts. Please wait before placing another order.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Custom key generator to rate limit by user ID instead of IP
    keyGenerator: function (req) {
        // Extract user ID from JWT token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return decoded._id; // Use user ID as rate limit key
            } catch (error) {
                // Fallback to IP if token is invalid
                return ipKeyGenerator(req);
            }
        }
        // Fallback to IP for unauthenticated requests
        return ipKeyGenerator(req);
    },
    // Skip successful requests to allow legitimate retries
    skipSuccessfulRequests: true,
});

// Tracking rate limiter (50 requests per 15 minutes per IP)
const trackRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: {
        success: false,
        message: 'Too many tracking requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    generalLimiter,
    authLimiter,
    otpLimiter,
    paymentLimiter,
    orderLimiter,
    trackRateLimiter
};