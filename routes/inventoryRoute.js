const express = require('express');
const { 
    getInventorySummary, 
    getLowStockItems, 
    getOutOfStockItems, 
    addStock,
    removeStock,
    adjustStock,
    getInventoryTransactions,
    getProductInventory
} = require('../controllers/inventoryController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');
const { validateAddStock, validateRemoveStock, validateAdjustStock, validateInventoryIntegrity } = require('../middlewares/inventoryValidation');

const router = express.Router();

router.route('/inventory').get(isAuthenticatedAdmin, getInventorySummary);
router.route('/inventory/low-stock').get(isAuthenticatedAdmin, getLowStockItems);
router.route('/inventory/out-of-stock').get(isAuthenticatedAdmin, getOutOfStockItems);
router.route('/inventory/add-stock').post(isAuthenticatedAdmin, validateAddStock, validateInventoryIntegrity, addStock);
router.route('/inventory/remove-stock').post(isAuthenticatedAdmin, validateRemoveStock, validateInventoryIntegrity, removeStock);
router.route('/inventory/adjust-stock').post(isAuthenticatedAdmin, validateAdjustStock, validateInventoryIntegrity, adjustStock);
router.route('/inventory/transactions').get(isAuthenticatedAdmin, getInventoryTransactions);
router.route('/inventory/product/:productId').get(isAuthenticatedAdmin, getProductInventory);

module.exports = router;