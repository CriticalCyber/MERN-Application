const express = require("express");
const { getAllTaxRates, toggleTaxRateStatus } = require("../controllers/taxRateController");
const { isAuthenticatedAdmin } = require("../middlewares/adminAuth.middleware");

const router = express.Router();

// Apply admin authentication middleware to each route individually
router.route("/").get(isAuthenticatedAdmin, getAllTaxRates);
router.route("/:id/toggle").patch(isAuthenticatedAdmin, toggleTaxRateStatus);

module.exports = router;