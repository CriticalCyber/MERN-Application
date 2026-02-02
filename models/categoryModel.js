const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter category name"],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        required: false
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    image: {
        key: {
            type: String,
            required: false
        },
        public_id: {
            type: String,
            required: false
        },
        url: {
            type: String,
            required: false
        }
    },
    subCategories: [
        {
            name: {
                type: String,
                required: true
            },
            description: {
                type: String
            }
        }
    ],
    isEnabled: {
        type: Boolean,
        default: true
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
categorySchema.index({ name: 1 });
categorySchema.index({ isEnabled: 1 });
categorySchema.index({ createdAt: 1 });

// Add version field for optimistic locking
categorySchema.add({ __v: { type: Number, default: 0 } });

// Pre-save middleware to generate slug and update timestamps
categorySchema.pre('save', function(next) {
    // Generate slug from name if not provided
    if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }
    
    // Update timestamp
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Category', categorySchema);