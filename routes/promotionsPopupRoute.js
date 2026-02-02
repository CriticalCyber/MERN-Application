const express = require('express');
const { getActivePromotionsForPopup } = require('../controllers/giftCardController');

const router = express.Router();

// Get active promotions for popup (gift cards and coupons)
router.route('/promotions/popup').get(getActivePromotionsForPopup);

module.exports = router;