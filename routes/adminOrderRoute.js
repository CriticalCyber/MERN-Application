const express = require('express');
const { getSingleOrderDetails, getAllOrders, updateOrder, deleteOrder } = require('../controllers/orderController');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

// Import rate limiting middleware
const { generalLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// ✅ ADMIN-ONLY ORDER ROUTES
// These routes are exclusively for admin users with session authentication
// Note: Router is mounted at /api/v1/admin in app.js, so paths here should NOT include /admin

router.route('/orders').get(isAuthenticatedAdmin, generalLimiter, getAllOrders);

router.route('/order/:id')
    .get(isAuthenticatedAdmin, generalLimiter, getSingleOrderDetails)
    .put(isAuthenticatedAdmin, generalLimiter, updateOrder)
    .delete(isAuthenticatedAdmin, generalLimiter, deleteOrder);

module.exports = router;