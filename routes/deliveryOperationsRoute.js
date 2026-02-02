const express = require('express');
const csrf = require('csurf');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { 
    assignDeliveryAgent, 
    updateDeliveryStatus, 
    getDeliveryById, 
    getDeliveries, 
    getAgentDeliveries,
    getDeliveryByTrackingId
} = require('../controllers/deliveryController');

const router = express.Router();

// CSRF Protection
const csrfProtection = csrf({ cookie: false });

/* ======================================================
   DELIVERY OPERATIONS ROUTES (ADMIN ONLY)
====================================================== */
// Assign delivery agent to order
router.post(
    '/admin/delivery/assign',
    isAuthenticatedAdmin,
    csrfProtection,
    assignDeliveryAgent
);

// Update delivery status
router.put(
    '/admin/delivery/update-status',
    isAuthenticatedAdmin,
    csrfProtection,
    updateDeliveryStatus
);

// Get delivery by ID
router.get(
    '/admin/delivery/:id',
    isAuthenticatedAdmin,
    csrfProtection,
    getDeliveryById
);

// Get all deliveries
router.get(
    '/admin/deliveries',
    isAuthenticatedAdmin,
    csrfProtection,
    getDeliveries
);

/* ======================================================
   DELIVERY OPERATIONS ROUTES (DELIVERY AGENT ONLY)
====================================================== */
// Get agent's deliveries
router.get(
    '/delivery-agent/my-deliveries',
    isAuthenticatedUser,
    csrfProtection,
    (req, res, next) => {
        // Check if user has delivery agent role
        if (req.user.role !== 'delivery_agent' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Delivery agents only.'
            });
        }
        getAgentDeliveries(req, res, next);
    }
);

// Update delivery status by delivery agent
router.put(
    '/delivery-agent/update-status',
    isAuthenticatedUser,
    csrfProtection,
    (req, res, next) => {
        // Check if user has delivery agent role
        if (req.user.role !== 'delivery_agent' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Delivery agents only.'
            });
        }
        updateDeliveryStatus(req, res, next);
    }
);

/* ======================================================
   PUBLIC DELIVERY TRACKING
====================================================== */
// Get delivery by tracking ID (public route for tracking)
router.get('/delivery/:trackingId', getDeliveryByTrackingId);

module.exports = router;