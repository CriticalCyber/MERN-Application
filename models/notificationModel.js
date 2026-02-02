const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Please enter notification title"],
        trim: true
    },
    message: {
        type: String,
        required: [true, "Please enter notification message"],
        trim: true
    },
    type: {
        type: String,
        enum: ['order', 'system', 'promotion', 'alert'],
        default: 'system'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // System-wide notifications won't have a userId
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    metadata: {
        type: Object, // Additional data related to the notification
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    readAt: {
        type: Date,
        default: null
    }
});

// Add indexes
notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ createdAt: -1 });

// Add version field for optimistic locking
notificationSchema.add({ __v: { type: Number, default: 0 } });

module.exports = mongoose.model('Notification', notificationSchema);