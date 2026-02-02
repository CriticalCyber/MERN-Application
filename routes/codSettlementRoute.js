const express = require('express');
const { 
    getAllCODSettlements, 
    getCODSettlementSummary, 
    getCODSettlementById, 
    updateCODSettlement,
    exportCODSettlements
} = require('../controllers/codSettlementController');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

// COD Settlement routes - admin only
router.route('/').get(isAuthenticatedAdmin, getAllCODSettlements);
router.route('/summary').get(isAuthenticatedAdmin, getCODSettlementSummary);
router.route('/:id').get(isAuthenticatedAdmin, getCODSettlementById);
router.route('/:id').put(isAuthenticatedAdmin, updateCODSettlement);
router.route('/export').get(isAuthenticatedAdmin, exportCODSettlements);

module.exports = router;