const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Please enter gift card code"],
        unique: true,
        trim: true,
        uppercase: true
    },
    balance: {
        type: Number,
        required: [true, "Please enter gift card balance"],
        min: [1, "Balance must be at least 1"]
    },
    initialBalance: {
        type: Number,
        required: [true, "Please enter initial balance"]
    },
    validFrom: {
        type: Date,
        required: [true, "Please enter valid from date"]
    },
    validUntil: {
        type: Date,
        required: [true, "Please enter valid until date"]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usedBy: [{
        user: {
            type: mongoose.Schema.ObjectId,
            ref: "User"
        },
        amount: {
            type: Number
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for frequently queried fields
giftCardSchema.index({ code: 1 });
giftCardSchema.index({ isActive: 1 });
giftCardSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('GiftCard', giftCardSchema);