const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter template name"],
        trim: true
    },
    subject: {
        type: String,
        required: [true, "Please enter subject"],
        trim: true
    },
    message: {
        type: String,
        required: [true, "Please enter message template"],
        trim: true
    },
    type: {
        type: String,
        enum: ['email', 'sms', 'push'],
        required: [true, "Please specify notification type"]
    },
    channel: {
        type: String,
        enum: ['order', 'system', 'promotion', 'alert'],
        default: 'system'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    variables: [{
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes
notificationTemplateSchema.index({ type: 1 });
notificationTemplateSchema.index({ channel: 1 });
notificationTemplateSchema.index({ isActive: 1 });

// Middleware to update updatedAt field
notificationTemplateSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);