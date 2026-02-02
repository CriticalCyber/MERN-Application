const express = require('express');
const { trackByAWB, trackByOrder } = require('../controllers/publicTrackingController');
const rateLimiter = require('../middlewares/rateLimiter');

const router = express.Router();

// Public tracking routes - no authentication required
router.route('/track/:awb').get(rateLimiter.trackRateLimiter, trackByAWB);
router.route('/track/order/:orderNumber').get(rateLimiter.trackRateLimiter, trackByOrder);

module.exports = router;