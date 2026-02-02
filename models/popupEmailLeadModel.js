const mongoose = require('mongoose');

const popupEmailLeadSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/.test(v);
            },
            message: 'Please enter a valid email'
        }
    },
    source: {
        type: String,
        default: 'Popup',
        enum: ['Popup', 'Newsletter', 'Contact', 'Other']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    ip: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    }
});

// Add indexes for frequently queried fields
popupEmailLeadSchema.index({ email: 1 });
popupEmailLeadSchema.index({ createdAt: -1 });
popupEmailLeadSchema.index({ source: 1 });

module.exports = mongoose.model('PopupEmailLead', popupEmailLeadSchema);