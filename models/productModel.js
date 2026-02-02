const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter product name"],
        trim: true
    },
    description: {
        type: String,
        required: false
    },
    highlights: [
        {
            type: String,
            required: false
        }
    ],
    specifications: [
        {
            title: {
                type: String,
                required: false
            },
            description: {
                type: String,
                required: false
            }
        }
    ],
    price: {
        type: Number,
        required: [true, "Please enter product price"]
    },
    mrp: {  // Maximum Retail Price
        type: Number,
        required: false,
        default: 0
    },
    cuttedPrice: {  // FIXED: Changed from discount_price to cuttedPrice
        type: Number,
        required: false,
        default: 0
    },
    discount: {  // Discount value
        type: Number,
        required: false,
        default: 0
    },
    discountType: {  // Type of discount (percentage or fixed amount)
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    },
    images: [
        {
            public_id: {
                type: String,
                required: true
            },
            url: {
                type: String,
                required: true
            },
            thumbnail: {
                type: String,
                required: false
            }
        }
    ],
    additional_images: [
        {
            public_id: {
                type: String,
                required: false
            },
            url: {
                type: String,
                required: false
            }
        }
    ],
    brand: {
        name: {
            type: String,
            required: true
        },
        logo: {
            public_id: {
                type: String,
                required: true,
            },
            url: {
                type: String,
                required: true,
            },
            thumbnail: {
                type: String,
                required: false
            }
        }
    },
    brandname: {  // ADDED: Direct brandname field for easier access
        type: String,
        required: false
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: "Category"
    },
    sku: {
        type: String,
        required: false,  // Changed to optional as it's auto-generated
        unique: true,
        sparse: true,  // Allow multiple null values
        trim: true
    },
    warranty: {
        type: Number,
        default: 1
    },
    ratings: {
        type: Number,
        default: 0
    },
    numOfReviews: {
        type: Number,
        default: 0
    },
    reviews: [
        {
            user: {
                type: mongoose.Schema.ObjectId,
                ref: "User",
                required: true
            },
            name: {
                type: String,
                required: true
            },
            rating: {
                type: Number,
                required: true
            },
            comment: {
                type: String,
                required: true
            }
        }
    ],
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: false  // Changed to optional for development
    },
    admin: {
        type: mongoose.Schema.ObjectId,
        ref: "Admin",
        required: false  // Changed to optional for admin-created products
    },

    // Stock is managed separately in the Inventory model
    // This field is kept for backward compatibility but not required
    stock: {
        type: Number,
        required: false,
        default: 0
    },
    minimumQty: {  // Minimum quantity required
        type: Number,
        required: false,
        default: 1
    },
    department: {  // Department/section of the product
        type: String,
        required: false
    },
    unit: {  // Unit of measurement (kg, g, ml, piece, etc.)
        type: String,
        required: false
    },
    taxRateId: {  // Reference to tax rate
        type: mongoose.Schema.ObjectId,
        ref: "TaxRate",
        required: false,
    },
    is_active: {
        type: Boolean,
        default: true
    },
    isActive: {  // Additional field for active status
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for frequently queried fields
productSchema.index({ name: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: 'text', description: 'text' });

// Add compound indexes for optimized queries at scale
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ 'brand.name': 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ ratings: -1, numOfReviews: -1 });
productSchema.index({ 'brand.name': 1, category: 1, price: 1 });

// Add version field for optimistic locking
productSchema.add({ __v: { type: Number, default: 0 } });

// Pre-save middleware to update timestamps
productSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Pre-save middleware to prevent direct stock updates
productSchema.pre('save', function(next) {
    // Check if stock field is being modified
    if (this.isModified('stock') && this.isNew) {
        // For new documents, allow stock to be set initially (for backward compatibility)
        console.warn(`Warning: Creating product with stock value ${this.stock}. Stock should be managed through Inventory model.`);
    } else if (this.isModified('stock') && !this.isNew) {
        // For existing documents, warn about direct stock updates
        console.warn(`Warning: Attempting to update product ${this._id} stock directly. Stock should be managed through Inventory model.`);
        // Optionally, you can uncomment the next line to throw an error and prevent the update
        // return next(new Error('Direct stock updates are not allowed. Use inventory service instead.'));
    }
    next();
});

// Pre-findOneAndUpdate middleware to prevent direct stock updates
productSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Check if stock is being updated in the $set operation
    if (update.$set && update.$set.stock !== undefined) {
        console.warn(`Warning: Attempting to update stock directly via findOneAndUpdate. Stock should be managed through Inventory model.`);
        // Optionally, you can uncomment the next line to throw an error and prevent the update
        // return next(new Error('Direct stock updates are not allowed. Use inventory service instead.'));
    }
    
    // Check if stock is being updated in the main update
    if (update.stock !== undefined) {
        console.warn(`Warning: Attempting to update stock directly via update. Stock should be managed through Inventory model.`);
        // Optionally, you can uncomment the next line to throw an error and prevent the update
        // return next(new Error('Direct stock updates are not allowed. Use inventory service instead.'));
    }
    
    next();
});

// Pre-updateMany middleware to prevent direct stock updates
productSchema.pre('updateMany', function(next) {
    const update = this.getUpdate();
    
    // Check if stock is being updated in the $set operation
    if (update.$set && update.$set.stock !== undefined) {
        console.warn(`Warning: Attempting to update stock directly via updateMany. Stock should be managed through Inventory model.`);
        // Optionally, you can uncomment the next line to throw an error and prevent the update
        // return next(new Error('Direct stock updates are not allowed. Use inventory service instead.'));
    }
    
    // Check if stock is being updated in the main update
    if (update.stock !== undefined) {
        console.warn(`Warning: Attempting to update stock directly via updateMany. Stock should be managed through Inventory model.`);
        // Optionally, you can uncomment the next line to throw an error and prevent the update
        // return next(new Error('Direct stock updates are not allowed. Use inventory service instead.'));
    }
    
    next();
});

module.exports = mongoose.model('Product', productSchema);