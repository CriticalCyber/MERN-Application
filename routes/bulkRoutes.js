const express = require('express');
const router = express.Router();
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');
const { 
    bulkUpdateProducts, 
    bulkDeleteProducts, 
    bulkPriceUpdate, 
    bulkStockUpdate, 
    bulkCategoryUpdate,
    bulkUploadCSV
} = require('../controllers/bulkController');
// Import CSV middleware
const { upload, parseCSV } = require('../middlewares/csvUpload');

// Apply authentication middleware to each route individually
// Bulk operations routes (admin-only)
router.route('/bulk-update')
    .put(isAuthenticatedAdmin, bulkUpdateProducts);

router.route('/bulk-delete')
    .delete(isAuthenticatedAdmin, bulkDeleteProducts);

router.route('/bulk-price-update')
    .put(isAuthenticatedAdmin, bulkPriceUpdate);

router.route('/bulk-stock-update')
    .put(isAuthenticatedAdmin, bulkStockUpdate);

router.route('/bulk-category-update')
    .put(isAuthenticatedAdmin, bulkCategoryUpdate);

// CSV upload route (admin-only)
router.route('/bulk-upload-csv')
    .post(isAuthenticatedAdmin, upload.single('csvFile'), parseCSV, bulkUploadCSV);

module.exports = router;