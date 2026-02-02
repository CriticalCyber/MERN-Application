const TaxRate = require("../models/taxRateModel");
const asyncErrorHandler = require("../middlewares/asyncErrorHandler");

// @desc    Get all tax rates
// @route   GET /api/admin/tax-rates
// @access  Private/Admin
const getAllTaxRates = asyncErrorHandler(async (req, res, next) => {
  const taxRates = await TaxRate.find({ isActive: true }).sort({ rate: 1 });

  res.status(200).json({
    success: true,
    count: taxRates.length,
    data: taxRates,
  });
});

// @desc    Toggle tax rate active status
// @route   PATCH /api/admin/tax-rates/:id/toggle
// @access  Private/Admin
const toggleTaxRateStatus = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;

  // Find the tax rate
  const taxRate = await TaxRate.findById(id);

  if (!taxRate) {
    return res.status(404).json({
      success: false,
      message: "Tax rate not found",
    });
  }

  // Toggle the active status
  taxRate.isActive = !taxRate.isActive;
  await taxRate.save();

  res.status(200).json({
    success: true,
    data: taxRate,
    message: `Tax rate ${taxRate.isActive ? "activated" : "deactivated"} successfully`,
  });
});

module.exports = {
  getAllTaxRates,
  toggleTaxRateStatus,
};