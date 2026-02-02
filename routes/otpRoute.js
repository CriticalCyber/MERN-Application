const express = require('express');
const { 
  requestOtp, 
  verifyOtp, 
  sendOtpLimiter, 
  verifyOtpLimiter 
} = require('../controllers/otpController');

const router = express.Router();

// Routes for OTP operations
router.route('/request-otp')
  .post(sendOtpLimiter, requestOtp);

router.route('/verify-otp')
  .post(verifyOtpLimiter, verifyOtp);

module.exports = router;