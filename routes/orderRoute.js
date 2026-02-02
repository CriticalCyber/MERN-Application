const express = require('express');
const { newOrder, getSingleOrderDetails, myOrders, getAllOrders, updateOrder, deleteOrder } = require('../controllers/orderController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

// Import rate limiting middleware
const { orderLimiter, generalLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.route('/order/new').post(isAuthenticatedUser, orderLimiter, newOrder);
router.route('/order/:id').get(isAuthenticatedUser, generalLimiter, getSingleOrderDetails);
router.route('/orders/me').get(isAuthenticatedUser, generalLimiter, myOrders);

router.route('/admin/orders').get(isAuthenticatedAdmin, generalLimiter, getAllOrders);

router.route('/admin/order/:id')
    .put(isAuthenticatedAdmin, generalLimiter, updateOrder)
    .delete(isAuthenticatedAdmin, generalLimiter, deleteOrder);

module.exports = router;