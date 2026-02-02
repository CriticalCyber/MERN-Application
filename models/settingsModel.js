const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    storeName: {
        type: String,
        required: [true, "Please enter store name"],
        trim: true
    },
    storeDescription: {
        type: String,
        required: [true, "Please enter store description"],
        trim: true
    },
    storeLogo: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        }
    },
    storeAddress: {
        street: {
            type: String,
            required: [true, "Please enter street address"]
        },
        city: {
            type: String,
            required: [true, "Please enter city"]
        },
        state: {
            type: String,
            required: [true, "Please enter state"]
        },
        pincode: {
            type: String,
            required: [true, "Please enter pincode"]
        },
        country: {
            type: String,
            required: [true, "Please enter country"]
        }
    },
    contactEmail: {
        type: String,
        required: [true, "Please enter contact email"],
        validate: {
            validator: function(v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: "Please enter a valid email"
        }
    },
    contactPhone: {
        type: String,
        required: [true, "Please enter contact phone"]
    },
    businessHours: {
        monday: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "21:00" },
            closed: { type: Boolean, default: false }
        },
        tuesday: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "21:00" },
            closed: { type: Boolean, default: false }
        },
        wednesday: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "21:00" },
            closed: { type: Boolean, default: false }
        },
        thursday: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "21:00" },
            closed: { type: Boolean, default: false }
        },
        friday: {
            open: { type: String, default: "09:00" },
            close: { type: String, default: "21:00" },
            closed: { type: Boolean, default: false }
        },
        saturday: {
            open: { type: String, default: "10:00" },
            close: { type: String, default: "22:00" },
            closed: { type: Boolean, default: false }
        },
        sunday: {
            open: { type: String, default: "10:00" },
            close: { type: String, default: "20:00" },
            closed: { type: Boolean, default: true }
        }
    },
    taxSettings: {
        gstEnabled: {
            type: Boolean,
            default: true
        },
        gstRate: {
            type: Number,
            default: 18 // Percentage
        },
        taxIncludedInPrice: {
            type: Boolean,
            default: false
        }
    },
    currency: {
        code: {
            type: String,
            default: "INR"
        },
        symbol: {
            type: String,
            default: "₹"
        }
    },
    socialMediaLinks: {
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" },
        instagram: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        youtube: { type: String, default: "" }
    },
    seoSettings: {
        metaTitle: { type: String, default: "" },
        metaDescription: { type: String, default: "" },
        metaKeywords: { type: String, default: "" }
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

// Add indexes
settingsSchema.index({ storeName: 1 });
settingsSchema.index({ contactEmail: 1 });
settingsSchema.index({ createdAt: 1 });

// Add version field for optimistic locking
settingsSchema.add({ __v: { type: Number, default: 0 } });

module.exports = mongoose.model('Settings', settingsSchema);