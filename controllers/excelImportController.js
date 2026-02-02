const Product = require("../models/productModel");
const TaxRate = require("../models/taxRateModel");
const Category = require("../models/categoryModel");
const Inventory = require("../models/inventoryModel");
const asyncErrorHandler = require("../middlewares/asyncErrorHandler");
const ErrorHandler = require("../utils/errorHandler");
const inventoryService = require('../services/inventoryService');
const xlsx = require("xlsx");

// @desc    Import products from Excel file
// @route   POST /api/admin/products/import-excel
// @access  Private/Admin
const importProductsFromExcel = asyncErrorHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler("Please upload an Excel file", 400));
  }

  try {
    // Read the uploaded Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip the header row
    const headers = excelData[0];
    const rows = excelData.slice(1);
    
    // Expected headers mapping
    const headerMap = {
      'Name': 'name',
      'Description': 'description',
      'Price': 'price',
      'Selling Price': 'price',
      'Category': 'category',
      'Department': 'category',
      'Sku': 'sku',
      'Product Code': 'sku',
      'Cutted Price': 'cuttedPrice',
      'Discounted Price': 'cuttedPrice',
      'Offer Price': 'cuttedPrice',
      'Stock': 'stock',
      'Qty': 'stock',
      'Quantity': 'stock',
      'Brand Name': 'brandname',
      'Brand': 'brandname',
      'Unit': 'unit',
      'Tax Rate': 'taxRate'
    };

    // Map headers to expected format (case-insensitive)
    const mappedHeaders = headers.map(header => {
      const normalizedHeader = String(header).trim();
      for (const [expected, mapped] of Object.entries(headerMap)) {
        if (normalizedHeader.toLowerCase() === expected.toLowerCase()) {
          return mapped;
        }
      }
      return normalizedHeader; // Return original if not found
    });

    // Get all active tax rates for validation
    const activeTaxRates = await TaxRate.find({ isActive: true });
    const taxRateMap = {};
    activeTaxRates.forEach(rate => {
      taxRateMap[rate.rate] = rate._id;
      taxRateMap[rate.label.toLowerCase()] = rate._id;
    });

    // Get all categories for validation
    const categories = await Category.find({});
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat._id;
    });

    const importResults = {
      totalRows: rows.length,
      importedCount: 0,
      skippedCount: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData = {};

      // Map row data to object using headers
      for (let j = 0; j < mappedHeaders.length; j++) {
        if (j < row.length) {
          rowData[mappedHeaders[j]] = row[j];
        }
      }

      try {
        // Validate required fields
        if (!rowData.name || typeof rowData.name !== 'string' || rowData.name.trim() === '') {
          throw new Error('Name is required');
        }
        
        if (!rowData.category || typeof rowData.category !== 'string' || rowData.category.trim() === '') {
          throw new Error('Category is required');
        }
        
        // Handle optional description - assign empty string if not provided or if empty
        let description = rowData.description;
        if (!description || typeof description !== 'string' || description.trim() === '') {
          description = '';
        } else {
          description = String(description).trim();
        }

        // Validate selling price
        const price = parseFloat(rowData.price);
        if (isNaN(price) || price <= 0) {
          throw new Error('Selling Price must be a positive number');
        }

        // Validate quantity
        const qty = parseInt(rowData.stock) || 0;
        if (isNaN(qty) || qty < 0) {
          throw new Error('Stock must be a non-negative number');
        }

        // Validate and map category
        let categoryId = null;
        let categoryName = rowData.category || rowData.department;
        if (categoryName && typeof categoryName === 'string') {
          categoryName = categoryName.trim();
          const normalizedCategory = categoryName.toLowerCase();
          
          if (categoryMap[normalizedCategory]) {
            // Use existing category ID
            categoryId = categoryMap[normalizedCategory];
          } else {
            // First check if category was created by another concurrent operation
            let existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
            if (existingCategory) {
              categoryId = existingCategory._id;
              categoryMap[normalizedCategory] = existingCategory._id;
            } else {
              // Create new category if it doesn't exist
              const newCategory = await Category.create({
                name: categoryName,
                description: `Auto-created category for ${categoryName}`,
                isEnabled: true
              });
              categoryId = newCategory._id;
              // Update the category map for subsequent products
              categoryMap[normalizedCategory] = newCategory._id;
            }
          }
        } else {
          // If no category provided, default to General
          let generalCategory = await Category.findOne({ name: { $regex: /^General$/i } });
          if (!generalCategory) {
            generalCategory = await Category.create({
              name: 'General',
              description: 'Default general category',
              isEnabled: true
            });
          }
          categoryId = generalCategory._id;
          categoryName = 'General';
        }

        // Validate and map tax rate
        let taxRateId = null;
        if (rowData.taxRate) {
          const taxRateValue = String(rowData.taxRate).trim().toLowerCase();
          if (taxRateMap[taxRateValue]) {
            taxRateId = taxRateMap[taxRateValue];
          } else {
            // Try to match by rate value (e.g., "5" or "5%")
            const rateMatch = taxRateValue.match(/(\d+(?:\.\d+)?)/);
            if (rateMatch) {
              const rateNum = parseFloat(rateMatch[1]);
              if (taxRateMap[rateNum]) {
                taxRateId = taxRateMap[rateNum];
              }
            }
          }
        }

        // If no tax rate found or provided, use default GST 5%
        if (!taxRateId) {
          const defaultTaxRate = await TaxRate.findOne({ rate: 5, isActive: true });
          if (defaultTaxRate) {
            taxRateId = defaultTaxRate._id;
          } else {
            // If 5% is not active, find any active tax rate
            const anyActiveTaxRate = await TaxRate.findOne({ isActive: true });
            if (anyActiveTaxRate) {
              taxRateId = anyActiveTaxRate._id;
            } else {
              throw new Error('No active tax rates available');
            }
          }
        }

        // Prepare product data
        const productData = {
          name: rowData.name.trim(),
          description: description,
          price: price,
          cuttedPrice: rowData.cuttedPrice ? parseFloat(rowData.cuttedPrice) : price,
          stock: qty,
          unit: rowData.unit ? String(rowData.unit).trim() : '',
          sku: rowData.sku || `${rowData.name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '')}${Date.now().toString().slice(-6)}`,
          brandname: rowData.brandname || rowData.name.substring(0, 20).trim(),
          isActive: true,
          is_active: true,
          taxRateId: taxRateId,
          // Set brand information
          brand: {
            name: rowData.brandname || rowData.name.substring(0, 20).trim(),
            logo: {
              public_id: 'placeholder_brand',
              url: '/uploads/products/default-brand.png',
            }
          },
          // Set default images
          images: [{
            public_id: 'placeholder',
            url: '/uploads/products/default-product.png',
          }]
        };
        
        // Set category after product data preparation - store ObjectId, not name
        productData.category = categoryId;

        // Check if product with same name already exists
        const existingProduct = await Product.findOne({ name: productData.name });
        if (existingProduct) {
          // Update the existing product instead of throwing an error
          await Product.findByIdAndUpdate(existingProduct._id, productData, {
            new: true,
            runValidators: true
          });
          
          // Update inventory for existing product
          try {
            let inventory = await Inventory.findOne({ product: existingProduct._id });
            if (inventory) {
              // Update existing inventory
              await inventoryService.adjustStock(
                existingProduct._id,
                productData.stock,
                `EXCEL_IMPORT_UPDATE_ROW_${i + 2}`,
                req.user?._id || null,
                'Stock updated from Excel import'
              );
            } else {
              // Create new inventory record
              await inventoryService.addStock(
                existingProduct._id,
                productData.stock,
                `EXCEL_IMPORT_CREATE_ROW_${i + 2}`,
                req.user?._id || null,
                'Initial stock from Excel import'
              );
            }
          } catch (inventoryError) {
            console.error(`Failed to update inventory for existing product ${existingProduct._id}:`, inventoryError.message);
          }
          
          importResults.importedCount++;
        } else {
          // Create the product
          const newProduct = await Product.create(productData);
          
          // Create inventory for new product
          try {
            await inventoryService.addStock(
              newProduct._id,
              productData.stock,
              `EXCEL_IMPORT_CREATE_ROW_${i + 2}`,
              req.user?._id || null,
              'Initial stock from Excel import'
            );
          } catch (inventoryError) {
            console.error(`Failed to create inventory for new product ${newProduct._id}:`, inventoryError.message);
          }
          
          importResults.importedCount++;
        }

      } catch (rowError) {
        importResults.skippedCount++;
        importResults.errors.push({
          row: i + 2, // +2 because we skip header and arrays are 0-indexed
          error: rowError.message,
          data: rowData
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Excel import completed. ${importResults.importedCount} products imported, ${importResults.skippedCount} skipped.`,
      data: importResults
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return next(new ErrorHandler(`Excel import failed: ${error.message}`, 500));
  }
});

module.exports = {
  importProductsFromExcel
};