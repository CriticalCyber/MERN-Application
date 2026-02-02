const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const otpUserSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: { unique: true }
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
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

// Pre-save hook to update the updatedAt field
otpUserSchema.pre('save', function(next) {
  this.updatedAt = Date.now;
  next();
});

// Method to generate JWT token for the user
otpUserSchema.methods.generateAuthToken = function() {
  const user = this;
  
  // Create a token with standardized userId field for consistency
  const token = jwt.sign(
    {
      userId: user._id,      // Canonical identity field
      mobile: user.mobile,
      name: user.name || null,
      email: user.email || null,
      isVerified: user.isVerified,
      role: 'customer',      // Explicit role for authorization
      exp: Math.floor(Date.now() / 1000) + (process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN) : 86400) // Default 24 hours
    },
    process.env.JWT_SECRET || 'fallback_secret_key'
  );
  
  return token;
};

// Static method to verify JWT token
otpUserSchema.statics.verifyToken = function(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    return decoded;
  } catch (error) {
    return null;
  }
};

// Index for mobile number to optimize lookups
otpUserSchema.index({ mobile: 1 });

module.exports = mongoose.model('OtpUser', otpUserSchema);