const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    resultInfo: {
        resultStatus: {
            type: String,
            required: true
        },
        resultCode: {
            type: String,
            required: true
        },
        resultMsg: {
            type: String,
            required: true
        },
    },
    txnId: {
        type: String,
        required: true
    },
    bankTxnId: {
        type: String,
        required: true
    },
    orderId: {
        type: String,
        required: true
    },
    txnAmount: {
        type: String,
        required: true
    },
    txnType: {
        type: String,
        required: true
    },
    gatewayName: {
        type: String,
        required: true
    },
    bankName: {
        type: String,
        required: true
    },
    mid: {
        type: String,
        required: true
    },
    paymentMode: {
        type: String,
        required: true
    },
    refundAmt: {
        type: String,
        required: true
    },
    txnDate: {
        type: String,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded', 'RECEIVED_COD'],
        default: 'pending'
    },
    settlementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CODSettlement',
        index: true
    },
    receivedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for better query performance
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ settlementId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ paymentStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);