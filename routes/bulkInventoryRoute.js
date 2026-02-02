const express = require('express');
const { 
    bulkUploadCSV,
    bulkUpdateInventoryCSV
} = require('../controllers/bulkInventoryController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');
const { upload, parseCSV } = require('../middlewares/csvUpload');

const router = express.Router();

router.route('/bulk-inventory-upload-csv')
    .post(
        isAuthenticatedAdmin, 
        upload.single('csvFile'),
        parseCSV,
        bulkUploadCSV
    );

router.route('/bulk-inventory-update-csv')
    .post(
        isAuthenticatedAdmin, 
        upload.single('csvFile'),
        parseCSV,
        bulkUpdateInventoryCSV
    );

module.exports = router;