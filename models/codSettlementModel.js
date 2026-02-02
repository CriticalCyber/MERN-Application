const mongoose = require('mongoose');

// COD Settlement Schema
const codSettlementSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    shipment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
        index: true
    },
    awb: {
        type: String,
        required: true,
        index: true
    },
    codAmount: {
        type: Number,
        required: true,
        min: 0
    },
    courierName: {
        type: String,
        required: true
    },
    settlementStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'SETTLED', 'FAILED'],
        default: 'PENDING',
        index: true
    },
    settlementDate: {
        type: Date
    },
    bankUTR: {
        type: String,
        index: true
    },
    rawWebhookPayload: {
        type: Object,
        default: {}
    },
    matchedWithBank: {
        type: Boolean,
        default: false
    },
    matchedDate: {
        type: Date
    },
    settlementNotes: {
        type: String
    },
    processedAt: {
        type: Date
    },
    processingError: {
        type: String
    }
}, {
    timestamps: true
});

// Add indexes for better query performance
codSettlementSchema.index({ createdAt: 1 });
codSettlementSchema.index({ settlementStatus: 1 });
codSettlementSchema.index({ settlementDate: 1 });
codSettlementSchema.index({ codAmount: 1 });
codSettlementSchema.index({ awb: 1, order: 1 }); // Compound index for unique awb-order combinations
codSettlementSchema.index({ bankUTR: 1 }); // For matching with bank records

const CODSettlement = mongoose.model('CODSettlement', codSettlementSchema);

module.exports = CODSettlement;