const express = require("express");
const { importProductsFromExcel } = require("../controllers/excelImportController");
const { isAuthenticatedAdmin } = require("../middlewares/adminAuth.middleware");
const { upload } = require("../middlewares/excelUpload");

const router = express.Router();

// Apply admin authentication middleware to route individually
// Import products from Excel file (admin-only)
router.route("/").post(isAuthenticatedAdmin, upload.single('file'), importProductsFromExcel);

module.exports = router;