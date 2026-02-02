const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        unique: true
    },
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    quantityAvailable: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    quantityReserved: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    reorderLevel: {
        type: Number,
        required: true,
        default: 10,
        min: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for better query performance
inventorySchema.index({ product: 1 });
inventorySchema.index({ sku: 1 });
inventorySchema.index({ quantityAvailable: 1 });
inventorySchema.index({ quantityReserved: 1 });
inventorySchema.index({ reorderLevel: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);