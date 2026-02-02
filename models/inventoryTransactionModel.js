const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['IN', 'OUT', 'ADJUSTMENT']
    },
    quantity: {
        type: Number,
        required: true
    },
    reference: {
        type: String,
        required: true,
        trim: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Add indexes for better query performance
inventoryTransactionSchema.index({ product: 1 });
inventoryTransactionSchema.index({ type: 1 });
inventoryTransactionSchema.index({ reference: 1 });
inventoryTransactionSchema.index({ performedBy: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);