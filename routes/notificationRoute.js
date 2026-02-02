const express = require('express');
const { 
    getAllNotifications,
    getNotification,
    createNotification,
    updateNotification,
    deleteNotification,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    sendTestNotification,
    setUserPreferences
} = require('../controllers/notificationController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

router.route('/notifications')
    .get(isAuthenticatedAdmin, getAllNotifications)
    .post(isAuthenticatedAdmin, createNotification);

router.route('/notifications/unread-count')
    .get(isAuthenticatedAdmin, getUnreadCount);

router.route('/notifications/mark-all-read')
    .put(isAuthenticatedAdmin, markAllAsRead);

router.route('/notification/:id')
    .get(isAuthenticatedAdmin, getNotification)
    .put(isAuthenticatedAdmin, updateNotification)
    .delete(isAuthenticatedAdmin, deleteNotification);

router.route('/notification/:id/read')
    .put(isAuthenticatedAdmin, markAsRead);

// New routes for notification functionality
router.route('/notifications/test')
    .post(isAuthenticatedAdmin, sendTestNotification);

router.route('/notifications/preferences')
    .post(isAuthenticatedAdmin, setUserPreferences);

module.exports = router;