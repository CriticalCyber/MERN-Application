const Notification = require('../models/notificationModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import notification service
const notificationService = require('../services/notificationService');

// Get All Notifications for Admin ---ADMIN
exports.getAllNotifications = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    const type = req.query.type;
    const priority = req.query.priority;
    const isRead = req.query.isRead;
    
    // Build filter object
    let filter = {};
    
    if (type) {
        filter.type = sanitizeInput(type);
    }
    
    if (priority) {
        filter.priority = sanitizeInput(priority);
    }
    
    if (isRead !== undefined) {
        filter.isRead = isRead === 'true';
    }
    
    // Count total notifications
    const notificationsCount = await Notification.countDocuments(filter);
    
    // Apply pagination and sorting
    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .populate('userId', 'name email phoneNumber')
        .populate('orderId', 'orderStatus')
        .lean();

    res.status(200).json({
        success: true,
        notifications,
        notificationsCount,
        resultPerPage,
        currentPage,
    });
});

// Get Notification Details ---ADMIN
exports.getNotification = asyncErrorHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id)
        .populate('userId', 'name email phoneNumber')
        .populate('orderId', 'orderStatus')
        .lean();

    if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
    }

    res.status(200).json({
        success: true,
        notification,
    });
});

// Create Notification ---ADMIN
exports.createNotification = asyncErrorHandler(async (req, res, next) => {
    // Sanitize inputs
    req.body.title = sanitizeInput(req.body.title);
    req.body.message = sanitizeInput(req.body.message);
    req.body.type = sanitizeInput(req.body.type);
    req.body.priority = sanitizeInput(req.body.priority);
    
    if (req.body.userId) {
        req.body.userId = sanitizeInput(req.body.userId);
    }
    
    if (req.body.orderId) {
        req.body.orderId = sanitizeInput(req.body.orderId);
    }

    const notification = await Notification.create(req.body);

    // If this is a user-specific notification, send it via preferred channels
    if (notification.userId) {
        // Get user details
        const User = require('../models/OtpUser');
        const user = await User.findById(notification.userId);
        
        if (user) {
            // Get Socket.IO instance from app
            const io = req.app.get('io');
            
            // Send multi-channel notification
            await notificationService.sendMultiChannelNotification(io, user, {
                title: notification.title,
                message: notification.message,
                type: notification.type,
                priority: notification.priority,
                data: notification.metadata || {}
            });
        }
    }

    res.status(201).json({
        success: true,
        notification
    });
});

// Update Notification ---ADMIN
exports.updateNotification = asyncErrorHandler(async (req, res, next) => {
    let notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
    }

    // Sanitize inputs
    if (req.body.title) req.body.title = sanitizeInput(req.body.title);
    if (req.body.message) req.body.message = sanitizeInput(req.body.message);
    if (req.body.type) req.body.type = sanitizeInput(req.body.type);
    if (req.body.priority) req.body.priority = sanitizeInput(req.body.priority);
    if (req.body.isRead !== undefined) {
        req.body.isRead = req.body.isRead;
        if (req.body.isRead && !notification.readAt) {
            req.body.readAt = Date.now();
        } else if (!req.body.isRead) {
            req.body.readAt = null;
        }
    }

    notification = await Notification.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
        notification
    });
});

// Delete Notification ---ADMIN
exports.deleteNotification = asyncErrorHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
    }

    await notification.remove();

    res.status(200).json({
        success: true,
        message: "Notification deleted successfully"
    });
});

// Mark Notification as Read ---ADMIN
exports.markAsRead = asyncErrorHandler(async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
    }

    notification.isRead = true;
    notification.readAt = Date.now();
    await notification.save();

    res.status(200).json({
        success: true,
        message: "Notification marked as read",
        notification
    });
});

// Mark All Notifications as Read ---ADMIN
exports.markAllAsRead = asyncErrorHandler(async (req, res, next) => {
    const result = await Notification.updateMany(
        { isRead: false },
        { 
            isRead: true,
            readAt: Date.now()
        }
    );

    res.status(200).json({
        success: true,
        message: `${result.nModified} notifications marked as read`,
        count: result.nModified
    });
});

// Get Unread Notifications Count ---ADMIN
exports.getUnreadCount = asyncErrorHandler(async (req, res, next) => {
    const count = await Notification.countDocuments({ isRead: false });

    res.status(200).json({
        success: true,
        count
    });
});

// Send Test Notification
exports.sendTestNotification = asyncErrorHandler(async (req, res, next) => {
    const { userId, type, message } = req.body;
    
    // Get user details
    const User = require('../models/OtpUser');
    const user = await User.findById(userId);
    
    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }
    
    // Get Socket.IO instance from app
    const io = req.app.get('io');
    
    // Send multi-channel notification
    const results = await notificationService.sendMultiChannelNotification(io, user, {
        title: "Test Notification",
        message: message || "This is a test notification",
        type: type || "system",
        priority: "medium"
    });
    
    res.status(200).json({
        success: true,
        message: "Test notification sent",
        results
    });
});

// Set User Notification Preferences
exports.setUserPreferences = asyncErrorHandler(async (req, res, next) => {
    const { userId, preferences } = req.body;
    
    // Set preferences in notification service
    notificationService.setUserPreferences(userId, preferences);
    
    res.status(200).json({
        success: true,
        message: "Notification preferences updated"
    });
});