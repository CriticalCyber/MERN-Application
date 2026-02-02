const mongoose = require('mongoose');

// Pickup Location Schema
const pickupLocationSchema = new mongoose.Schema({
    shiprocketPickupId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    contactPerson: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true,
        default: 'India'
    },
    pincode: {
        type: String,
        required: true
    },
    gstNo: {
        type: String
    },
    company: {
        type: String
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    assignedInventoryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
    }],
    serviceableAreas: [{
        pincode: String,
        city: String,
        state: String
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

// Add indexes for better query performance
pickupLocationSchema.index({ isActive: 1 });
pickupLocationSchema.index({ isDefault: 1 });
pickupLocationSchema.index({ city: 1 });
pickupLocationSchema.index({ state: 1 });
pickupLocationSchema.index({ pincode: 1 });

// Pre-save middleware to update the updatedAt field
pickupLocationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const PickupLocation = mongoose.model('PickupLocation', pickupLocationSchema);

module.exports = PickupLocation;