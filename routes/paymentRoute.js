const express = require('express');
const { getPaymentStatus, processRazorpayPayment, verifyRazorpayPayment } = require('../controllers/paymentController');
const { handlePaymentWebhook } = require('../controllers/paymentWebhookController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
// Import rate limiting middleware
const { paymentLimiter, generalLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.route('/payment/status/:id').get(isAuthenticatedUser, generalLimiter, getPaymentStatus);

// Razorpay routes - FIXED: Added /payment/ prefix
router.route('/payment/razorpay/process').post(isAuthenticatedUser, paymentLimiter, processRazorpayPayment);
router.route('/payment/razorpay/verify').post(isAuthenticatedUser, paymentLimiter, verifyRazorpayPayment);

// Payment webhook route - no auth required as external services will call this
router.route('/webhook').post(handlePaymentWebhook);

module.exports = router;