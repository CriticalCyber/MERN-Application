const express = require('express');
const { getActivePromotionsForPopup } = require('../controllers/giftCardController');
const { collectPopupEmailLead } = require('../controllers/giftCardController');

const router = express.Router();

// Get active promotions for popup (gift cards and coupons) - PUBLIC ROUTE
router.route('/promotions/popup').get(getActivePromotionsForPopup);

// Collect email lead from popup - PUBLIC ROUTE
router.route('/popup/collect-email').post(collectPopupEmailLead);

module.exports = router;