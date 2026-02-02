const express = require('express');
const csrf = require('csurf');
const { 
    getDeliverySettings,
    updateDeliverySettings,
    getAllDeliveryAreas,
    getDeliveryArea,
    createDeliveryArea,
    updateDeliveryArea,
    deleteDeliveryArea,
    toggleDeliveryAreaStatus,
    getAllDeliverySlots,
    getDeliverySlot,
    createDeliverySlot,
    updateDeliverySlot,
    deleteDeliverySlot,
    toggleDeliverySlotStatus
} = require('../controllers/deliverySettingsController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

// CSRF Protection
const csrfProtection = csrf({ cookie: false });

// Delivery Settings Routes
router.route('/delivery/settings')
    .get(isAuthenticatedAdmin, getDeliverySettings)
    .put(isAuthenticatedAdmin, updateDeliverySettings);

// Delivery Areas Routes
router.route('/delivery/areas')
    .get(isAuthenticatedAdmin, getAllDeliveryAreas)
    .post(isAuthenticatedAdmin, createDeliveryArea);

router.route('/delivery/area/:id')
    .get(isAuthenticatedAdmin, getDeliveryArea)
    .put(isAuthenticatedAdmin, updateDeliveryArea)
    .delete(isAuthenticatedAdmin, deleteDeliveryArea);

router.route('/delivery/area/:id/toggle')
    .put(isAuthenticatedAdmin, toggleDeliveryAreaStatus);

// Delivery Slots Routes
router.route('/delivery/slots')
    .get(isAuthenticatedAdmin, getAllDeliverySlots)
    .post(isAuthenticatedAdmin, createDeliverySlot);

router.route('/delivery/slot/:id')
    .get(isAuthenticatedAdmin, getDeliverySlot)
    .put(isAuthenticatedAdmin, updateDeliverySlot)
    .delete(isAuthenticatedAdmin, deleteDeliverySlot);

router.route('/delivery/slot/:id/toggle')
    .put(isAuthenticatedAdmin, toggleDeliverySlotStatus);

module.exports = router;