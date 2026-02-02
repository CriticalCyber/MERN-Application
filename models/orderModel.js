const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    shippingInfo: {
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
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        phoneNo: {
            type: Number,
            required: true
        },
    },
    orderItems: [
        {
            name: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            image: {
                type: String,
                required: true
            },
            product: {
                type: mongoose.Schema.ObjectId,
                ref: "Product",
                required: true
            },
        },
    ],
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "otpUser",
        required: true
    },
    paymentInfo: {
        id: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true
        },
    },
    paidAt: {
        type: Date,
        required: function() {
            return this.paymentInfo?.status === 'paid';
        }
    },
    
    // ========== PRICING FIELDS WITH DISCOUNT SUPPORT ==========
    itemsPrice: {
        type: Number,
        required: true,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    couponCode: {
        type: String,
        default: null
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    deliveryCharge: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },
    // =========================================================
    
    orderStatus: {
        type: String,
        required: true,
        default: "Processing",
    },
    deliveredAt: Date,
    shippedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // Local delivery fields
    deliveryType: {
        type: String,
        enum: ["LOCAL", "SHIPROCKET"],
        default: "LOCAL"
    },
    deliveryStatus: {
        type: String,
        enum: [
            "Pending",
            "Confirmed",
            "Packed",
            "Assigned",
            "Out for Delivery",
            "Delivered",
            "Cancelled",
            "RTO"
        ],
        default: "Pending"
    },
    deliveryAgent: {
        type: mongoose.Schema.ObjectId,
        ref: "otpUser",
        default: null
    },
    deliveryDate: Date,
    estimatedDeliveryDate: Date,
    deliveryNotes: String,
    deliveryAddress: {
        type: String,
        default: ""
    },
    deliveryAgentName: String,
    deliveryAgentPhone: String,
    trackingId: String,
    deliveryEta: String
});

// Add indexes for frequently queried fields
orderSchema.index({ user: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ totalPrice: 1 });
orderSchema.index({ paymentInfo: 1 });
orderSchema.index({ deliveryStatus: 1 });
orderSchema.index({ deliveryAgent: 1 });
orderSchema.index({ deliveryType: 1 });
orderSchema.index({ deliveryDate: 1 });
orderSchema.index({ estimatedDeliveryDate: 1 });
orderSchema.index({ couponCode: 1 });

module.exports = mongoose.model("Order", orderSchema);