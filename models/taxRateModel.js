const mongoose = require("mongoose");

const taxRateSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, "Tax rate label is required"],
    unique: true,
    trim: true,
  },
  rate: {
    type: Number,
    required: [true, "Tax rate value is required"],
    min: [0, "Tax rate cannot be negative"],
    max: [100, "Tax rate cannot exceed 100%"],
    validate: {
      validator: function(v) {
        // Allow only specific GST rates: 0, 5, 12, 18, 28, 40
        return [0, 5, 12, 18, 28, 40].includes(v);
      },
      message: 'Tax rate must be one of the standard GST slabs: 0, 5, 12, 18, 28, 40'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("TaxRate", taxRateSchema);