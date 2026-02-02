// Admin User Management Controller
// Only admin-facing user management functions

const User = require('../models/OtpUser');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import socket event emitters
const { 
    emitUserUpdated, 
    emitUserDeleted 
} = require('../utils/socketEvents');

// Get All Users --ADMIN
exports.getAllUsers = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    
    // Validate pagination parameters
    if (resultPerPage > 100) {
        return next(new ErrorHandler("Limit cannot exceed 100", 400));
    }
    
    if (currentPage < 1) {
        return next(new ErrorHandler("Page must be greater than 0", 400));
    }
    
    // Use estimatedDocumentCount for better performance
    const usersCount = await User.estimatedDocumentCount();
    
    // Apply pagination with optimized query
    const users = await User.find()
        .select('name email phoneNumber gender role createdAt')
        .sort({ createdAt: -1 })
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .lean()
        .exec(); // Execute query explicitly for better memory management

    // Add memory usage logging for monitoring
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    if (heapUsedMB > 800) { // Log if memory usage is high
        console.warn(`High memory usage detected in getAllUsers: ${heapUsedMB}MB`);
    }

    res.status(200).json({
        success: true,
        users,
        usersCount,
        resultPerPage,
        currentPage,
        // Include memory stats in response for debugging
        memoryStats: {
            heapUsed: heapUsedMB,
            rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100
        }
    });
});

// Get Single User Details --ADMIN
exports.getSingleUser = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.params.id).select('-__v').lean();

    if(!user) {
        return next(new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        user,
    });
});

// Update User Role --ADMIN
exports.updateUserRole = asyncErrorHandler(async (req, res, next) => {
    // Sanitize inputs
    req.body.name = sanitizeInput(req.body.name);
    req.body.email = sanitizeInput(req.body.email);
    if (req.body.phoneNumber) {
        req.body.phoneNumber = sanitizeInput(req.body.phoneNumber);
    }

    const newUserData = {
        name: req.body.name,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        gender: req.body.gender,
        role: req.body.role,
    }

    const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });
    
    // Emit socket event for user update
    const io = req.app.get('io');
    emitUserUpdated(io, user);

    res.status(200).json({
        success: true,
    });
});

// Delete Role --ADMIN
exports.deleteUser = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.params.id);

    if(!user) {
        return next(new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404));
    }

    // For local storage, we're not automatically deleting avatar files
    // In a production environment, you might want to implement a cleanup mechanism

    await user.remove();
    
    // Emit socket event for user deletion
    const io = req.app.get('io');
    emitUserDeleted(io, req.params.id);

    res.status(200).json({
        success: true
    });
});