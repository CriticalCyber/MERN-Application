const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const TaxRate = require('../models/taxRateModel');
const ErrorHandler = require('../utils/errorHandler');
const { sanitizeInput } = require('../utils/sanitize');
const { emitProductCreated, emitProductUpdated } = require('../utils/socketEvents');

// Get default tax rate (5% as default)
const getDefaultTaxRate = async () => {
    let defaultTaxRate = await TaxRate.findOne({ rate: 5, isActive: true });
    if (!defaultTaxRate) {
        // Create a default 5% tax rate if it doesn't exist
        defaultTaxRate = await TaxRate.create({
            name: 'Standard Tax Rate - 5%',
            rate: 5,
            description: 'Default tax rate for products',
            isActive: true
        });
    }
    return defaultTaxRate;
};

// Bulk upload products from Excel with validation and mapping
exports.bulkUploadExcel = asyncErrorHandler(async (req, res, next) => {
    // This route uses the Excel upload middleware
    // The parsed Excel data is available in req.excelData

    if (!req.excelData || !Array.isArray(req.excelData) || req.excelData.length === 0) {
        return next(new ErrorHandler("No valid Excel data provided or empty file", 400));
    }

    const originalExcelData = req.excelData;

    // Validate required columns exist in Excel with case-insensitive mapping
    const requiredColumns = ['name', 'price', 'category'];
    const firstRow = originalExcelData[0];
    const missingColumns = [];
    
    // Create a mapping of normalized header names to original names
    const headerMap = {};
    Object.keys(firstRow).forEach(key => {
        const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, ''); // Remove all spaces
        headerMap[normalizedKey] = key;
    });

    // Define expected header mappings (case-insensitive)
    const expectedHeaderMap = {
        'name': ['name', 'product name', 'title'],
        'description': ['description', 'product description', 'desc'],
        'price': ['price', 'selling price', 'unit price', 'rate'],
        'category': ['category', 'product category', 'category name', 'department'],
        'sku': ['sku', 'product sku', 'product code', 'item code'],
        'cuttedPrice': ['cuttedprice', 'cutted price', 'discounted price', 'offer price', 'sale price'],
        'stock': ['stock', 'quantity', 'qty', 'amount', 'available', 'available qty', 'available quantity'],
        'brandname': ['brandname', 'brand name', 'brand', 'manufacturer', 'producer'],
        'unit': ['unit', 'units', 'measurement unit', 'unit type', 'measure unit']
    };

    // Check for each required column using the mapping
    requiredColumns.forEach(column => {
        let found = false;
        
        // Check exact match first
        if (headerMap[column.toLowerCase().replace(/\s+/g, '')]) {
            found = true;
        } else {
            // Check expected variations
            const variations = expectedHeaderMap[column] || [column.toLowerCase()];
            for (const variation of variations) {
                if (headerMap[variation.toLowerCase().replace(/\s+/g, '')]) {
                    found = true;
                    break;
                }
            }
        }
        

        
        if (!found) {
            missingColumns.push(column);
        }
    });

    if (missingColumns.length > 0) {
        return next(new ErrorHandler(`Missing required columns in Excel: ${missingColumns.join(', ')}`, 400));
    }
    
    // Update the excelData to use consistent column names
    const mappedExcelData = originalExcelData.map(row => {
        const mappedRow = {};
        
        for (const [key, value] of Object.entries(row)) {
            const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, ''); // Remove all spaces
            
            // Find which expected column this key maps to
            let mappedKey = normalizedKey; // default to normalized key
            for (const [expectedCol, variations] of Object.entries(expectedHeaderMap)) {
                const normalizedVariations = variations.map(v => v.toLowerCase().replace(/\s+/g, ''));
                if (normalizedVariations.includes(normalizedKey)) {
                    mappedKey = expectedCol;
                    break;
                }
            }
            
            mappedRow[mappedKey] = value;
        }
        
        return mappedRow;
    });
    
    // Use the mapped data instead of original
    const excelData = mappedExcelData;

    // Start background processing
    setUploadStatus('processing', 0, excelData.length, 0, 'Starting import...');
        
    // Process in background
    console.log('Starting background processing for', excelData.length, 'rows');
    processExcelDataInBackground(excelData, req.admin._id, req.app.get('io'));
        
    // Respond immediately with processing status
    console.log('Sending immediate response to client');
    res.status(200).json({
        success: true,
        message: 'Inventory upload in progress...',
        status: 'processing'
    });
});

// Process Excel data in the background
const processExcelDataInBackground = async (excelData, adminId, io) => {
    console.log('Background processing started with', excelData.length, 'total rows');
    console.log('Admin ID:', adminId);
    const results = {
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        errors: [],
        processedProducts: []
    };
    
    try {
        console.log('Starting chunk processing...');
        // Process data in chunks
        const CHUNK_SIZE = 100;
        
        for (let i = 0; i < excelData.length; i += CHUNK_SIZE) {
            const chunk = excelData.slice(i, i + CHUNK_SIZE);
            console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}, size: ${chunk.length}, range: ${i} to ${i + chunk.length - 1}`);
            
            const chunkProductsToCreate = [];
            const chunkProductsToUpdate = [];
            const chunkProductRows = [];
            
            for (let j = 0; j < chunk.length; j++) {
                const row = chunk[j];
                const rowIndex = i + j + 1;
                
                // Log row data for debugging
                if (j === 0) { // Log first row of each chunk as sample
                    console.log(`Sample row data in chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, row);
                }

                try {
                    // Validate required fields
                    console.log(`Validating row ${rowIndex}:`, {
                        name: !!row.name,
                        description: !!row.description,
                        price: !!row.price,
                        category: !!row.category
                    });
                    
                    if (!row.name || !row.price || !row.category) {
                        console.log(`Row ${rowIndex} skipped due to missing required fields`);
                        results.errors.push({
                            row: rowIndex,
                            error: "Missing required fields: name, price, or category"
                        });
                        results.skippedCount++;
                        continue;
                    }

                    // Handle optional description - assign empty string if not provided or if empty
                    let description = row.description;
                    if (!description || typeof description !== 'string' || description.trim() === '') {
                        description = '';
                    } else {
                        description = sanitizeInput(description.toString());
                    }

                    // Sanitize inputs
                    const name = sanitizeInput(row.name?.toString()) || '';
                    const price = parseFloat(row.price);
                    const sku = sanitizeInput(row.sku?.toString()) || `${name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '')}${Date.now().toString().slice(-6)}`;
                    const cuttedPrice = parseFloat(row.cuttedPrice) || price;
                    const stock = parseInt(row.stock) || 0;
                    const brandname = sanitizeInput(row.brandname?.toString()) || 'Unknown';
                    const unit = sanitizeInput(row.unit?.toString()) || '';
                    const taxRateId = sanitizeInput(row.taxRateId?.toString()) || null;

                    // Validate numeric fields
                    if (isNaN(price) || price < 0) {
                        results.errors.push({
                            row: rowIndex,
                            error: "Invalid price value"
                        });
                        results.skippedCount++;
                        continue;
                    }

                    if (isNaN(stock) || stock < 0) {
                        results.errors.push({
                            row: rowIndex,
                            error: "Invalid stock value"
                        });
                        results.skippedCount++;
                        continue;
                    }

                    // Find or assign tax rate
                    let assignedTaxRateId = null;
                    if (taxRateId) {
                        const taxRate = await TaxRate.findById(taxRateId);
                        if (taxRate && taxRate.isActive) {
                            assignedTaxRateId = taxRateId;
                        } else {
                            // Use default tax rate if provided tax rate is invalid or inactive
                            const defaultTaxRate = await getDefaultTaxRate();
                            assignedTaxRateId = defaultTaxRate._id;
                        }
                    } else {
                        // Use default tax rate if none provided
                        const defaultTaxRate = await getDefaultTaxRate();
                        assignedTaxRateId = defaultTaxRate._id;
                    }

                    // Create product object
                    const productData = {
                        name: name,
                        description: description,
                        price: price,
                        cuttedPrice: cuttedPrice,
                        stock: stock,
                        unit: unit,
                        sku: sku,
                        taxRateId: assignedTaxRateId,
                        is_active: true,
                        isActive: true,
                        brand: {
                            name: brandname,
                            logo: {
                                public_id: "default_brand",
                                url: "/default-brand.png"
                            }
                        },
                        admin: adminId // Admin user making the request
                    };

                    // Handle category mapping
                    let categoryValue = sanitizeInput(row.category?.toString()) || sanitizeInput(row.department?.toString()) || "General";
                    if (categoryValue && categoryValue.toLowerCase() !== 'general') {
                        // Check if category exists in DB
                        let category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryValue}$`, 'i') } });
                        if (!category) {
                            // Create new category if it doesn't exist
                            category = await Category.create({
                                name: categoryValue,
                                description: `Auto-created category for ${categoryValue}`,
                                isEnabled: true
                            });
                        }
                        productData.category = category._id; // Store ObjectId, not name
                    } else {
                        // Ensure General category exists
                        let generalCategory = await Category.findOne({ name: { $regex: /^General$/i } });
                        if (!generalCategory) {
                            generalCategory = await Category.create({
                                name: 'General',
                                description: 'Default general category',
                                isEnabled: true
                            });
                        }
                        productData.category = generalCategory._id; // Store ObjectId, not name
                    }

                    // Check if product with same name already exists
                    const existingProduct = await Product.findOne({ name: name.trim() });
                    
                    if (existingProduct) {
                        console.log(`Found existing product for row ${rowIndex}, adding to update list:`, productData.name);
                        // Add to update list
                        chunkProductsToUpdate.push({
                            filter: { _id: existingProduct._id },
                            update: productData
                        });
                        chunkProductRows.push({
                            id: existingProduct._id,
                            name: productData.name,
                            status: 'updated',
                            row: rowIndex
                        });
                    } else {
                        console.log(`New product for row ${rowIndex}, adding to create list:`, productData.name);
                        // Add to create list
                        chunkProductsToCreate.push(productData);
                        chunkProductRows.push({
                            name: productData.name,
                            status: 'created',
                            row: rowIndex
                        });
                    }
                } catch (error) {
                    results.errors.push({
                        row: rowIndex,
                        error: error.message
                    });
                    results.failedCount++;
                }
            }

            // Perform bulk operations for this chunk
            try {
                // Bulk create new products in this chunk
                console.log(`About to create ${chunkProductsToCreate.length} products in this chunk`);
                if (chunkProductsToCreate.length > 0) {
                    const createdProducts = await Product.insertMany(chunkProductsToCreate);
                    
                    // Update the chunkProductRows with created product IDs
                    for (let k = 0; k < createdProducts.length; k++) {
                        chunkProductRows.find(p => p.name === createdProducts[k].name && p.status === 'created').id = createdProducts[k]._id;
                    }
                    
                    results.successCount += chunkProductsToCreate.length;
                    
                    // Emit socket events for created products
                    for (const product of createdProducts) {
                        emitProductCreated(io, product);
                    }
                }

                // Bulk update existing products in this chunk
                console.log(`About to update ${chunkProductsToUpdate.length} products in this chunk`);
                if (chunkProductsToUpdate.length > 0) {
                    const bulkWriteOps = chunkProductsToUpdate.map(updateObj => ({
                        updateOne: {
                            filter: updateObj.filter,
                            update: updateObj.update
                        }
                    }));
                    
                    await Product.bulkWrite(bulkWriteOps);
                    results.successCount += chunkProductsToUpdate.length;
                    
                    // Emit socket events for updated products
                    for (const updateObj of chunkProductsToUpdate) {
                        const updatedProduct = await Product.findById(updateObj.filter._id);
                        emitProductUpdated(io, updatedProduct.toJSON());
                    }
                } else {
                    console.log('No products to update in this chunk');
                }
            } catch (error) {
                setUploadStatus('failed', 0, excelData.length, results.successCount + results.failedCount, `Bulk operation failed: ${error.message}`, error.message);
                return;
            }

            results.processedProducts = [...results.processedProducts, ...chunkProductRows];
            
            // Update progress status
            const processed = Math.min(i + CHUNK_SIZE, excelData.length);
            const progress = Math.round((processed / excelData.length) * 100);
            setUploadStatus('processing', progress, excelData.length, processed, `Processed ${processed} of ${excelData.length} rows`);
        }

        // Final status update
        console.log('Final results:', results);
        setUploadStatus('completed', 100, excelData.length, results.successCount, `Import completed. ${results.successCount} products processed successfully.`);
        
    } catch (error) {
        setUploadStatus('failed', 0, excelData.length, results.successCount + results.failedCount, `Processing failed: ${error.message}`, error.message);
    }
};

// Get all tax rates
exports.getTaxRates = asyncErrorHandler(async (req, res, next) => {
    const taxRates = await TaxRate.find({}).sort({ rate: 1 });
    
    res.status(200).json({
        success: true,
        taxRates
    });
});

// Upload status tracking (for background processing)
let uploadStatus = {
    status: 'idle', // idle, processing, completed, failed
    progress: 0,
    total: 0,
    processed: 0,
    message: 'Ready to process',
    error: null
};

// Set upload status
const setUploadStatus = (status, progress, total, processed, message, error = null) => {
    uploadStatus = {
        status,
        progress,
        total,
        processed,
        message,
        error,
        updatedAt: new Date().toISOString()
    };
};

// Get upload status
exports.getUploadStatus = asyncErrorHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        status: uploadStatus
    });
});

// Create default tax rates
exports.createDefaultTaxRates = asyncErrorHandler(async (req, res, next) => {
    const defaultRates = [
        { name: 'Tax Rate - 5%', rate: 5, description: 'Standard tax rate', isActive: true },
        { name: 'Tax Rate - 12%', rate: 12, description: 'Standard tax rate', isActive: true },
        { name: 'Tax Rate - 18%', rate: 18, description: 'Standard tax rate', isActive: true },
        { name: 'Tax Rate - 28%', rate: 28, description: 'Standard tax rate', isActive: true },
        { name: 'Tax Rate - 40%', rate: 40, description: 'Luxury tax rate', isActive: true },
    ];

    const createdRates = [];
    for (const rate of defaultRates) {
        const existingRate = await TaxRate.findOne({ rate: rate.rate });
        if (!existingRate) {
            const newRate = await TaxRate.create({
                ...rate,
                createdBy: req.admin._id
            });
            createdRates.push(newRate);
        }
    }

    res.status(200).json({
        success: true,
        message: `${createdRates.length} default tax rates created`,
        createdRates
    });
});