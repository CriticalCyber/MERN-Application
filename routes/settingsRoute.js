const express = require('express');
const { 
    getStoreSettings,
    updateStoreSettings,
    getBusinessHours,
    updateBusinessHours,
    getTaxSettings,
    updateTaxSettings
} = require('../controllers/settingsController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

// Store Settings Routes
router.route('/settings/store')
    .get(isAuthenticatedAdmin, getStoreSettings)
    .put(isAuthenticatedAdmin, updateStoreSettings);

// Business Hours Routes
router.route('/settings/business-hours')
    .get(isAuthenticatedAdmin, getBusinessHours)
    .put(isAuthenticatedAdmin, updateBusinessHours);

// Tax Settings Routes
router.route('/settings/tax')
    .get(isAuthenticatedAdmin, getTaxSettings)
    .put(isAuthenticatedAdmin, updateTaxSettings);

module.exports = router;