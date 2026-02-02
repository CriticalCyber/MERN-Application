const express = require('express');
const { newOrder, getSingleOrderDetails, myOrders } = require('../controllers/orderController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');

// Import rate limiting middleware
const { orderLimiter, generalLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// ✅ USER-ONLY ORDER ROUTES
// These routes are exclusively for customer users with JWT authentication

router.route('/order/new').post(isAuthenticatedUser, orderLimiter, newOrder);
router.route('/order/:id').get(isAuthenticatedUser, generalLimiter, getSingleOrderDetails);
router.route('/orders/me').get(isAuthenticatedUser, generalLimiter, myOrders);

module.exports = router;