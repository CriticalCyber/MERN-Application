const express = require('express');
const router = express.Router();
const { upload, parseExcel } = require('../middlewares/excelUpload');
const { bulkUploadExcel, getTaxRates, createDefaultTaxRates, getUploadStatus } = require('../controllers/bulkExcelController');
const isAuthenticatedAdmin = require('../middlewares/adminAuth');

// Bulk upload products from Excel
router.route('/upload-excel')
    .post(
        isAuthenticatedAdmin,
        upload.single('excelFile'),
        parseExcel,
        bulkUploadExcel
    );

// Get all tax rates
router.route('/tax-rates')
    .get(isAuthenticatedAdmin, getTaxRates);

// Get upload status
router.route('/upload-status')
    .get(isAuthenticatedAdmin, getUploadStatus);

// Create default tax rates
router.route('/create-default-tax-rates')
    .post(isAuthenticatedAdmin, createDefaultTaxRates);

module.exports = router;