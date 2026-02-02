const OtpUser = require('../models/OtpUser');
const msg91AuthService = require('../services/msg91AuthService');
const rateLimit = require('express-rate-limit');
const { isValidIndianMobile, normalizeIndianMobile } = require('../utils/mobileUtils');
const { ipKeyGenerator } = rateLimit;

/**
 * Request OTP to be sent to mobile number
 * Validates mobile number and sends OTP via MSG91
 */
const requestOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile number
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indian mobile number format'
      });
    }

    // Send OTP via MSG91 service
    const result = await msg91AuthService.sendOtp(mobile);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message || 'OTP sent successfully',
        mobile: result.mobile
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to send OTP',
        error_code: result.error_code
      });
    }
  } catch (error) {
    console.error('Error in requestOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred while requesting OTP'
    });
  }
};

/**
 * Verify OTP for mobile number
 * If successful, creates/updates user and returns JWT
 */
const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // Validate inputs
    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required'
      });
    }

    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Indian mobile number format'
      });
    }

    // Verify OTP via MSG91 service
    const result = await msg91AuthService.verifyOtp(mobile, otp);

    if (result.success) {
      // Find or create user in database
      let user = await OtpUser.findOne({ mobile: result.mobile });

      if (user) {
        // Update existing user
        user.isVerified = true;
        user.lastLoginAt = new Date();
        user.loginCount = user.loginCount + 1;
        await user.save();
      } else {
        // Create new user
        user = new OtpUser({
          mobile: result.mobile,
          isVerified: true,
          lastLoginAt: new Date(),
          loginCount: 1
        });
        await user.save();
      }

      // Generate JWT token
      const token = user.generateAuthToken();

      return res.status(200).json({
        success: true,
        message: result.message || 'OTP verified successfully',
        token,
        user: {
          _id: user._id,
          mobile: user.mobile,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          role: 'customer'  // Explicit role for frontend
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'OTP verification failed',
        error_code: result.error_code
      });
    }
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred while verifying OTP'
    });
  }
};

// Rate limiter for send OTP endpoint (1 request per phone per 60 seconds)
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 1, // Limit each mobile number to 1 request per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests from this mobile number, please try again after 60 seconds.'
  },
  keyGenerator: function(req) {
    // Use mobile number from request body as the rate limit key
    const { mobile } = req.body;
    if (mobile) {
      try {
        // Normalize the mobile number for consistent rate limiting
        const normalizedMobile = normalizeIndianMobile(mobile);
        return normalizedMobile;
      } catch (error) {
        // If mobile is invalid, use IP as fallback
        return ipKeyGenerator(req);
      }
    }
    return ipKeyGenerator(req);
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Rate limiter for verify OTP endpoint (3 attempts per phone per 5 minutes)
const verifyOtpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each mobile number to 3 attempts per windowMs
  message: {
    success: false,
    message: 'Too many OTP verification attempts from this mobile number, please try again after 5 minutes.'
  },
  keyGenerator: function(req) {
    // Use mobile number from request body as the rate limit key
    const { mobile } = req.body;
    if (mobile) {
      try {
        // Normalize the mobile number for consistent rate limiting
        const normalizedMobile = normalizeIndianMobile(mobile);
        return normalizedMobile;
      } catch (error) {
        // If mobile is invalid, use IP as fallback
        return ipKeyGenerator(req);
      }
    }
    return ipKeyGenerator(req);
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: true // Skip rate limiting for successful verifications
});

module.exports = {
  requestOtp,
  verifyOtp,
  sendOtpLimiter,
  verifyOtpLimiter
};