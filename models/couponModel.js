const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Please enter coupon code"],
        unique: true,
        trim: true,
        uppercase: true
    },
    discountType: {
        type: String,
        required: [true, "Please select discount type"],
        enum: ["percentage", "fixed"]
    },
    discountValue: {
        type: Number,
        required: [true, "Please enter discount value"]
    },
    minimumAmount: {
        type: Number,
        default: 0
    },
    maximumDiscount: {
        type: Number,
        default: 0
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usedCount: {
        type: Number,
        default: 0
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
    applicableCategories: [{
        type: String
    }],
    applicableProducts: [{
        type: mongoose.Schema.ObjectId,
        ref: "Product"
    }],
    userLimit: {
        type: Number,
        default: 1 // How many times a single user can use this coupon
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for frequently queried fields
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('Coupon', couponSchema);