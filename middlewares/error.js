const ErrorHandler = require("../utils/errorHandler");

// Track ongoing requests to prevent hanging
const ongoingRequests = new Map();

module.exports = (err, req, res, next) => {
    // Remove request from tracking
    const requestId = req.requestId || `${req.method}-${req.url}-${Date.now()}`;
    ongoingRequests.delete(requestId);
    
    // Log error for debugging
    console.error(`[${requestId}] Error:`, err.stack || err);
    
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";

    // mongodb id error
    if (err.name === "CastError") {
        const message = `Resource Not Found. Invalid: ${err.path}`;
        err = new ErrorHandler(message, 400)
    }

    // mongoose duplicate key error
    if (err.code === 11000) {
        const message = `Duplicate ${Object.keys(err.keyValue)} entered`;
        err = new ErrorHandler(message, 400);
    }

    // wrong jwt error
    if (err.name === "JsonWebTokenError") {
        const message = 'JWT Error';
        err = new ErrorHandler(message, 400);
    }

    // jwt expire error
    if (err.name === "TokenExpiredError") {
        const message = 'JWT is Expired';
        err = new ErrorHandler(message, 400);
    }
    
    // Memory error handling
    if (err.name === "RangeError" || err.message.includes("memory") || err.message.includes("heap")) {
        const message = 'Server is experiencing high memory usage. Please try again later.';
        err = new ErrorHandler(message, 503);
    }
    
    // Handle timeout errors
    if (err.name === "TimeoutError" || err.message.includes("timeout")) {
        const message = 'Request timed out. Please try again later.';
        err = new ErrorHandler(message, 408);
    }
    
    // Handle CSRF errors
    if (err.code === "EBADCSRFTOKEN") {
        const message = 'Invalid CSRF token. Please refresh the page and try again.';
        err = new ErrorHandler(message, 403);
    }

    // Ensure response is sent only once
    if (res.headersSent) {
        return next(err);
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        // Include request ID for debugging
        requestId: requestId
    });
};

// Middleware to track ongoing requests
module.exports.requestTracker = (req, res, next) => {
    const requestId = `${req.method}-${req.url}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    // Track the request
    ongoingRequests.set(requestId, {
        timestamp: Date.now(),
        method: req.method,
        url: req.url,
        ip: req.ip
    });
    
    // Set a timeout to prevent hanging requests
    const timeout = setTimeout(() => {
        if (ongoingRequests.has(requestId)) {
            console.warn(`Request ${requestId} timed out after 30 seconds`);
            ongoingRequests.delete(requestId);
            
            // If headers haven't been sent yet, send a timeout response
            if (!res.headersSent) {
                res.status(408).json({
                    success: false,
                    message: 'Request timeout',
                    requestId: requestId
                });
            }
        }
    }, 30000); // 30 seconds timeout
    
    // Clear timeout when response is finished
    res.on('finish', () => {
        clearTimeout(timeout);
        ongoingRequests.delete(requestId);
    });
    
    // Clear timeout when connection is closed
    req.on('close', () => {
        clearTimeout(timeout);
        ongoingRequests.delete(requestId);
    });
    
    next();
};

// Utility function to get ongoing requests (for monitoring)
module.exports.getOngoingRequests = () => {
    return Array.from(ongoingRequests.entries()).map(([id, data]) => ({
        id,
        ...data,
        duration: Date.now() - data.timestamp
    }));
};