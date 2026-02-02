const mongoose = require('mongoose');

const deliveryAreaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter area name"],
        trim: true
    },
    pincode: {
        type: String,
        required: [true, "Please enter pincode"],
        trim: true
    },
    city: {
        type: String,
        required: [true, "Please enter city"],
        trim: true
    },
    state: {
        type: String,
        required: [true, "Please enter state"],
        trim: true
    },
    isServicable: {
        type: Boolean,
        default: true
    },
    deliveryCharge: {
        type: Number,
        default: 0
    },
    estimatedDeliveryTime: {
        type: String, // e.g., "1-2 days", "Same day", etc.
        default: "1-2 days"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const deliverySlotSchema = new mongoose.Schema({
    startTime: {
        type: String, // e.g., "09:00"
        required: [true, "Please enter start time"]
    },
    endTime: {
        type: String, // e.g., "12:00"
        required: [true, "Please enter end time"]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    maxOrders: {
        type: Number,
        default: 50
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const deliverySettingsSchema = new mongoose.Schema({
    baseDeliveryCharge: {
        type: Number,
        default: 0
    },
    freeDeliveryThreshold: {
        type: Number,
        default: 500 // Free delivery for orders above ₹500
    },
    maxDeliveryDistance: {
        type: Number,
        default: 20 // in kilometers
    },
    deliverySlots: [deliverySlotSchema],
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
deliveryAreaSchema.index({ pincode: 1 });
deliveryAreaSchema.index({ city: 1 });
deliveryAreaSchema.index({ isServicable: 1 });
deliverySlotSchema.index({ isActive: 1 });
deliverySettingsSchema.index({ createdAt: 1 });

// Add version field for optimistic locking
deliveryAreaSchema.add({ __v: { type: Number, default: 0 } });
deliverySlotSchema.add({ __v: { type: Number, default: 0 } });
deliverySettingsSchema.add({ __v: { type: Number, default: 0 } });

const DeliveryArea = mongoose.model('DeliveryArea', deliveryAreaSchema);
const DeliverySlot = mongoose.model('DeliverySlot', deliverySlotSchema);
const DeliverySettings = mongoose.model('DeliverySettings', deliverySettingsSchema);

module.exports = {
    DeliveryArea,
    DeliverySlot,
    DeliverySettings
};