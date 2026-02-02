const express = require('express');
const { getAllCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon, applyCoupon, getActiveCoupons } = require('../controllers/couponController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

router.route('/coupons').get(isAuthenticatedAdmin, getAllCoupons);
router.route('/coupons/active').get(getActiveCoupons);
router.route('/coupon/new').post(isAuthenticatedAdmin, createCoupon);

router.route('/coupon/:id')
    .get(isAuthenticatedAdmin, getCoupon)
    .put(isAuthenticatedAdmin, updateCoupon)
    .delete(isAuthenticatedAdmin, deleteCoupon);

router.route('/coupon/apply').post(applyCoupon);

module.exports = router;