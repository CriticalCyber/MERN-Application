const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Product = require('../models/productModel');
const Inventory = require('../models/inventoryModel');
const ErrorHandler = require('../utils/errorHandler');
const inventoryService = require('../services/inventoryService');
// Import socket event emitters
const { 
    emitProductCreated, 
    emitProductUpdated, 
    emitStockUpdated 
} = require('../utils/socketEvents');
// Import sanitization utilities
const { sanitizeInput } = require('../utils/sanitize');
// Import CSV middleware
const { upload, parseCSV } = require('../middlewares/csvUpload');

// Bulk upload products and inventory from CSV with SKU-based logic
exports.bulkUploadCSV = asyncErrorHandler(async (req, res, next) => {
    // This route uses the CSV upload middleware
    // The parsed CSV data is available in req.csvData
    
    if (!req.csvData || !Array.isArray(req.csvData)) {
        return next(new ErrorHandler("No valid CSV data provided", 400));
    }
    
    const csvData = req.csvData;
    const batchSize = 50; // Process in smaller batches for inventory operations
    const results = {
        successCount: 0,
        failedCount: 0,
        updatedCount: 0,
        errors: [],
        processedProducts: []
    };
    
    // Process data in batches
    for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        const batchProducts = [];
        const batchErrors = [];
        const existingSKUs = [];
        const newSKUs = [];
        
        // First pass: Identify existing vs new products by SKU
        for (let j = 0; j < batch.length; j++) {
            const rowIndex = i + j;
            const row = batch[j];
            
            try {
                // Validate required fields
                if (!row.name || !row.sku || !row.price || !row.description || !row.category) {
                    batchErrors.push({
                        row: rowIndex + 1,
                        error: "Missing required fields: name, sku, price, description, or category"
                    });
                    continue;
                }
                
                // Check if product with this SKU already exists
                const existingProduct = await Product.findOne({ sku: row.sku }).lean();
                
                if (existingProduct) {
                    existingSKUs.push({
                        rowIndex: rowIndex,
                        row: row,
                        productId: existingProduct._id
                    });
                } else {
                    newSKUs.push({
                        rowIndex: rowIndex,
                        row: row
                    });
                }
            } catch (error) {
                batchErrors.push({
                    row: rowIndex + 1,
                    error: error.message
                });
            }
        }
        
        // Process existing products (update)
        for (const existing of existingSKUs) {
            try {
                // Update product details
                const updateData = {
                    name: sanitizeInput(existing.row.name),
                    description: sanitizeInput(existing.row.description),
                    category: sanitizeInput(existing.row.category),
                    price: parseFloat(existing.row.price),
                    cuttedPrice: existing.row.cuttedPrice ? parseFloat(existing.row.cuttedPrice) : parseFloat(existing.row.price),
                    highlights: existing.row.highlights ? existing.row.highlights.split(',').map(h => sanitizeInput(h.trim())) : [],
                    // Brand information
                    brand: {
                        name: existing.row.brandName || "Unknown",
                        logo: {
                            public_id: "default_brand",
                            url: "/default-brand.png"
                        }
                    }
                };
                
                const updatedProduct = await Product.findByIdAndUpdate(
                    existing.productId,
                    updateData,
                    { new: true, runValidators: true }
                );
                
                // Update inventory if quantity is provided
                if (existing.row.quantity !== undefined) {
                    const quantity = parseInt(existing.row.quantity) || 0;
                    
                    try {
                        // Try to get existing inventory
                        let inventory = await Inventory.findOne({ product: existing.productId });
                        
                        if (inventory) {
                            // Update existing inventory
                            await inventoryService.adjustStock(
                                existing.productId,
                                quantity,
                                `CSV Bulk Update Row ${existing.rowIndex + 1}`,
                                req.user._id,
                                'Bulk update from CSV'
                            );
                        } else {
                            // Create new inventory record
                            await inventoryService.addStock(
                                existing.productId,
                                quantity,
                                `CSV Bulk Create Row ${existing.rowIndex + 1}`,
                                req.user._id,
                                'Initial stock from CSV'
                            );
                        }
                    } catch (inventoryError) {
                        batchErrors.push({
                            row: existing.rowIndex + 1,
                            error: `Inventory update failed: ${inventoryError.message}`
                        });
                        continue;
                    }
                }
                
                // Emit socket event for product update
                const io = req.app.get('io');
                emitProductUpdated(io, updatedProduct.toJSON());
                
                results.updatedCount++;
                results.processedProducts.push(updatedProduct._id);
            } catch (error) {
                batchErrors.push({
                    row: existing.rowIndex + 1,
                    error: error.message
                });
            }
        }
        
        // Process new products (create)
        for (const newItem of newSKUs) {
            try {
                // Sanitize input data
                const productData = {
                    name: sanitizeInput(newItem.row.name),
                    sku: sanitizeInput(newItem.row.sku),
                    description: sanitizeInput(newItem.row.description),
                    category: sanitizeInput(newItem.row.category),
                    price: parseFloat(newItem.row.price),
                    cuttedPrice: newItem.row.cuttedPrice ? parseFloat(newItem.row.cuttedPrice) : parseFloat(newItem.row.price),
                    highlights: newItem.row.highlights ? newItem.row.highlights.split(',').map(h => sanitizeInput(h.trim())) : [],
                    // Brand information
                    brand: {
                        name: newItem.row.brandName || "Unknown",
                        logo: {
                            public_id: "default_brand",
                            url: "/default-brand.png"
                        }
                    }
                };
                
                // Create product
                const newProduct = new Product(productData);
                await newProduct.save();
                
                // Create inventory record if quantity is provided
                if (newItem.row.quantity !== undefined) {
                    const quantity = parseInt(newItem.row.quantity) || 0;
                    
                    try {
                        await inventoryService.addStock(
                            newProduct._id,
                            quantity,
                            `CSV Bulk Create Row ${newItem.rowIndex + 1}`,
                            req.user._id,
                            'Initial stock from CSV'
                        );
                    } catch (inventoryError) {
                        batchErrors.push({
                            row: newItem.rowIndex + 1,
                            error: `Inventory creation failed: ${inventoryError.message}`
                        });
                        // Continue with the product creation even if inventory fails
                    }
                }
                
                // Emit socket event for product creation
                const io = req.app.get('io');
                emitProductCreated(io, newProduct.toJSON());
                
                results.successCount++;
                results.processedProducts.push(newProduct._id);
            } catch (error) {
                batchErrors.push({
                    row: newItem.rowIndex + 1,
                    error: error.message
                });
            }
        }
        
        // Add batch errors to results
        results.errors.push(...batchErrors);
        results.failedCount += batchErrors.length;
    }
    
    res.status(200).json({
        success: true,
        message: `CSV upload completed. ${results.successCount} products created, ${results.updatedCount} products updated, ${results.failedCount} failed.`,
        ...results
    });
});

// Bulk update inventory from CSV
exports.bulkUpdateInventoryCSV = asyncErrorHandler(async (req, res, next) => {
    // This route uses the CSV upload middleware
    // The parsed CSV data is available in req.csvData
    
    if (!req.csvData || !Array.isArray(req.csvData)) {
        return next(new ErrorHandler("No valid CSV data provided", 400));
    }
    
    const csvData = req.csvData;
    const batchSize = 50; // Process in smaller batches for inventory operations
    const results = {
        successCount: 0,
        failedCount: 0,
        errors: [],
        updatedInventories: []
    };
    
    // Process data in batches
    for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        const batchErrors = [];
        
        // Process each row
        for (let j = 0; j < batch.length; j++) {
            const rowIndex = i + j;
            const row = batch[j];
            
            try {
                // Validate required fields
                if (!row.sku) {
                    batchErrors.push({
                        row: rowIndex + 1,
                        error: "Missing required field: sku"
                    });
                    continue;
                }
                
                // Find product by SKU
                const product = await Product.findOne({ sku: row.sku }).lean();
                
                if (!product) {
                    batchErrors.push({
                        row: rowIndex + 1,
                        error: `Product with SKU ${row.sku} not found`
                    });
                    continue;
                }
                
                // Update inventory
                if (row.quantity !== undefined) {
                    const quantity = parseInt(row.quantity) || 0;
                    
                    try {
                        // Try to get existing inventory
                        let inventory = await Inventory.findOne({ product: product._id });
                        
                        if (inventory) {
                            // Update existing inventory
                            await inventoryService.adjustStock(
                                product._id,
                                quantity,
                                `CSV Inventory Update Row ${rowIndex + 1}`,
                                req.user._id,
                                'Bulk inventory update from CSV'
                            );
                        } else {
                            // Create new inventory record
                            await inventoryService.addStock(
                                product._id,
                                quantity,
                                `CSV Inventory Create Row ${rowIndex + 1}`,
                                req.user._id,
                                'Initial stock from CSV'
                            );
                        }
                        
                        results.successCount++;
                        results.updatedInventories.push(product._id);
                        
                        // Emit socket event for stock update
                        const io = req.app.get('io');
                        emitStockUpdated(io, {
                            _id: product._id,
                            name: product.name,
                            sku: product.sku,
                            quantity: quantity
                        });
                    } catch (inventoryError) {
                        batchErrors.push({
                            row: rowIndex + 1,
                            error: `Inventory update failed: ${inventoryError.message}`
                        });
                    }
                } else {
                    batchErrors.push({
                        row: rowIndex + 1,
                        error: "Missing quantity field"
                    });
                }
            } catch (error) {
                batchErrors.push({
                    row: rowIndex + 1,
                    error: error.message
                });
            }
        }
        
        // Add batch errors to results
        results.errors.push(...batchErrors);
        results.failedCount += batchErrors.length;
    }
    
    res.status(200).json({
        success: true,
        message: `Inventory update completed. ${results.successCount} inventories updated, ${results.failedCount} failed.`,
        ...results
    });
});