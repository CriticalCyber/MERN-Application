const mongoose = require('mongoose');

// Delivery Schema - Generic for both local and courier delivery
const deliverySchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    deliveryId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    deliveryType: {
        type: String,
        enum: ['LOCAL', 'COURIER'],
        default: 'LOCAL'
    },
    deliveryStatus: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'packed',
            'assigned',
            'out_for_delivery',
            'delivered',
            'cancelled',
            'rto',
            'return_to_origin'
        ],
        default: 'pending'
    },
    deliveryAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deliveryAgentName: {
        type: String,
        default: ''
    },
    deliveryAgentPhone: {
        type: String,
        default: ''
    },
    trackingId: {
        type: String,
        unique: true,
        sparse: true, // Allow null values but ensure uniqueness when present
        index: true
    },
    deliveryCompany: {
        type: String,
        default: 'Local Delivery'
    },
    pickupLocation: {
        type: String,
        default: 'Default'
    },
    pickupScheduledDate: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    deliveredBy: {
        type: String,
        default: ''
    },
    deliveredAtTime: {
        type: Date
    },
    estimatedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    totalWeight: {
        type: Number, // in grams
        default: 0
    },
    declaredValue: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['Prepaid', 'COD'],
        default: 'Prepaid'
    },
    shippingCharges: {
        type: Number,
        default: 0
    },
    deliveryCharges: {
        type: Number,
        default: 0
    },
    codAmount: {
        type: Number,
        default: 0
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        statusMessage: {
            type: String
        },
        date: {
            type: Date,
            default: Date.now
        },
        location: {
            type: String
        }
    }],
    deliveryNotes: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    cancelledAt: {
        type: Date
    },
    cancellationReason: {
        type: String
    },
    deliveryEta: String
}, {
    timestamps: true
});

// Add indexes for better query performance
deliverySchema.index({ createdAt: 1 });
deliverySchema.index({ updatedAt: 1 });
deliverySchema.index({ deliveryStatus: 1 });
deliverySchema.index({ orderId: 1, deliveryStatus: 1 });
deliverySchema.index({ deliveryAgent: 1 });
deliverySchema.index({ deliveryType: 1 });

deliverySchema.index({ trackingId: 1 });
deliverySchema.index({ deliveryId: 1 });

const Delivery = mongoose.model('Delivery', deliverySchema);

module.exports = Delivery;