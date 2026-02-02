const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Product = require('../models/productModel');
const ErrorHandler = require('../utils/errorHandler');
const inventoryService = require('../services/inventoryService');
// Import sanitization utilities
const { sanitizeInput } = require('../utils/sanitize');
// Import socket event emitters
const { 
    emitProductCreated, 
    emitProductUpdated, 
    emitProductDeleted,
    emitStockUpdated
} = require('../utils/socketEvents');
// Import CSV middleware
const { upload, parseCSV } = require('../middlewares/csvUpload');

// Bulk update products
exports.bulkUpdateProducts = asyncErrorHandler(async (req, res, next) => {
    const { productIds, updateData } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new ErrorHandler("Product IDs are required", 400));
    }
    
    if (!updateData || typeof updateData !== 'object') {
        return next(new ErrorHandler("Update data is required", 400));
    }
    
    // Sanitize update data
    const sanitizedUpdateData = {};
    for (const key in updateData) {
        if (typeof updateData[key] === 'string') {
            sanitizedUpdateData[key] = sanitizeInput(updateData[key]);
        } else {
            sanitizedUpdateData[key] = updateData[key];
        }
    }
    
    try {
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: sanitizedUpdateData },
            { new: true, runValidators: true }
        );
        
        // Emit socket event for product updates
        const io = req.app.get('io');
        productIds.forEach(productId => {
            emitProductUpdated(io, { _id: productId, ...sanitizedUpdateData });
        });
        
        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} products updated successfully`,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        return next(new ErrorHandler("Bulk update failed", 500));
    }
});

// Bulk delete products
exports.bulkDeleteProducts = asyncErrorHandler(async (req, res, next) => {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new ErrorHandler("Product IDs are required", 400));
    }
    
    try {
        const result = await Product.deleteMany({ _id: { $in: productIds } });
        
        // Emit socket event for product deletions
        const io = req.app.get('io');
        productIds.forEach(productId => {
            emitProductDeleted(io, productId);
        });
        
        res.status(200).json({
            success: true,
            message: `${result.deletedCount} products deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        return next(new ErrorHandler("Bulk delete failed", 500));
    }
});

// Bulk price update
exports.bulkPriceUpdate = asyncErrorHandler(async (req, res, next) => {
    const { productIds, operation, value } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new ErrorHandler("Product IDs are required", 400));
    }
    
    if (!operation || !['increase', 'decrease'].includes(operation)) {
        return next(new ErrorHandler("Operation must be 'increase' or 'decrease'", 400));
    }
    
    if (typeof value !== 'number' || value <= 0) {
        return next(new ErrorHandler("Value must be a positive number", 400));
    }
    
    try {
        let updateQuery = {};
        
        if (operation === 'increase') {
            updateQuery = { $inc: { price: value } };
        } else {
            updateQuery = { $inc: { price: -value } };
        }
        
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            updateQuery,
            { new: true, runValidators: true }
        );
        
        // Emit socket event for product updates
        const io = req.app.get('io');
        // Fetch the updated products to emit the full updated data
        const updatedProducts = await Product.find({ _id: { $in: productIds } });
        updatedProducts.forEach(product => {
            emitProductUpdated(io, product.toJSON());
        });
        
        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} products price updated successfully`,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        return next(new ErrorHandler("Bulk price update failed", 500));
    }
});

// Bulk stock update
exports.bulkStockUpdate = asyncErrorHandler(async (req, res, next) => {
    const { productIds, operation, value } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new ErrorHandler("Product IDs are required", 400));
    }
    
    if (!operation || !['increase', 'decrease'].includes(operation)) {
        return next(new ErrorHandler("Operation must be 'increase' or 'decrease'", 400));
    }
    
    if (typeof value !== 'number' || value < 0) {
        return next(new ErrorHandler("Value must be a non-negative number", 400));
    }
    
    try {
        let successCount = 0;
        
        // Process each product individually to update inventory
        for (const productId of productIds) {
            try {
                // Get current inventory to determine new quantity
                let currentInventory = await inventoryService.getInventorySummary(productId);
                let newQuantity;
                
                if (operation === 'increase') {
                    newQuantity = (currentInventory?.quantityAvailable || 0) + value;
                } else {
                    // For decrease operation, ensure stock doesn't go below 0
                    const currentQty = currentInventory?.quantityAvailable || 0;
                    newQuantity = Math.max(0, currentQty - value);
                }
                
                // Update inventory using inventory service
                await inventoryService.adjustStock(
                    productId,
                    newQuantity,
                    `BULK_STOCK_${operation.toUpperCase()}_ID_${req.user?._id || 'SYSTEM'}`,
                    req.user?._id || null,
                    `Bulk stock ${operation} operation via admin panel`
                );
                
                successCount++;
            } catch (inventoryError) {
                console.error(`Failed to update inventory for product ${productId}:`, inventoryError.message);
                // Continue with other products
            }
        }
        
        // Emit socket event for stock updates
        const io = req.app.get('io');
        // Fetch the updated products to emit the full updated data
        const updatedProducts = await Product.find({ _id: { $in: productIds } });
        updatedProducts.forEach(product => {
            emitStockUpdated(io, product.toJSON());
        });
        
        res.status(200).json({
            success: true,
            message: `${successCount} products stock updated successfully`,
            modifiedCount: successCount,
            matchedCount: productIds.length
        });
    } catch (error) {
        return next(new ErrorHandler("Bulk stock update failed", 500));
    }
});

// Bulk category reassignment
exports.bulkCategoryUpdate = asyncErrorHandler(async (req, res, next) => {
    const { productIds, category } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return next(new ErrorHandler("Product IDs are required", 400));
    }
    
    if (!category || typeof category !== 'string') {
        return next(new ErrorHandler("Category is required", 400));
    }
    
    // Sanitize category
    const sanitizedCategory = sanitizeInput(category);
    
    try {
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: { category: sanitizedCategory } },
            { new: true, runValidators: true }
        );
        
        // Emit socket event for product updates
        const io = req.app.get('io');
        // Fetch the updated products to emit the full updated data
        const updatedProducts = await Product.find({ _id: { $in: productIds } });
        updatedProducts.forEach(product => {
            emitProductUpdated(io, product.toJSON());
        });
        
        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} products category updated successfully`,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        return next(new ErrorHandler("Bulk category update failed", 500));
    }
});

// Bulk upload products from CSV
exports.bulkUploadCSV = asyncErrorHandler(async (req, res, next) => {
    // This route uses the CSV upload middleware
    // The parsed CSV data is available in req.csvData
    
    if (!req.csvData || !Array.isArray(req.csvData)) {
        return next(new ErrorHandler("No valid CSV data provided", 400));
    }
    
    const csvData = req.csvData;
    const batchSize = 100; // Process in batches of 100
    const results = {
        successCount: 0,
        failedCount: 0,
        errors: [],
        insertedProducts: []
    };
    
    // Process data in batches
    for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        const batchProducts = [];
        const batchErrors = [];
        
        // Prepare batch data
        for (let j = 0; j < batch.length; j++) {
            const rowIndex = i + j;
            const row = batch[j];
            
            try {
                // Validate required fields
                if (!row.name || !row.price || !row.description || !row.category) {
                    batchErrors.push({
                        row: rowIndex + 1,
                        error: "Missing required fields: name, price, description, or category"
                    });
                    continue;
                }
                
                // Sanitize input data
                const productData = {
                    name: sanitizeInput(row.name),
                    description: sanitizeInput(row.description),
                    category: sanitizeInput(row.category),
                    price: parseFloat(row.price),
                    cuttedPrice: row.cuttedPrice ? parseFloat(row.cuttedPrice) : parseFloat(row.price),
                    stock: row.stock ? parseInt(row.stock) : 0,
                    highlights: row.highlights ? row.highlights.split(',').map(h => sanitizeInput(h.trim())) : [],
                    // Brand information would need to be handled separately
                    brand: {
                        name: row.brandName || "Unknown",
                        logo: {
                            public_id: "default_brand",
                            url: "/default-brand.png"
                        }
                    }
                };
                
                batchProducts.push(productData);
            } catch (error) {
                batchErrors.push({
                    row: rowIndex + 1,
                    error: error.message
                });
            }
        }
        
        // Insert batch
        try {
            const insertedBatch = await Product.insertMany(batchProducts, { ordered: false });
            
            // Create inventory records for each new product
            for (const product of insertedBatch) {
                const row = batch.find(r => sanitizeInput(r.name) === product.name);
                if (row && row.stock !== undefined) {
                    const stock = parseInt(row.stock) || 0;
                    try {
                        await inventoryService.addStock(
                            product._id,
                            stock,
                            `CSV_UPLOAD_${Date.now()}`,
                            req.user?._id || null,
                            'Initial stock from CSV upload'
                        );
                    } catch (inventoryError) {
                        console.error(`Failed to create inventory for product ${product._id}:`, inventoryError.message);
                        // Continue with other products
                    }
                }
            }
            
            // Emit socket events for product creations
            const io = req.app.get('io');
            insertedBatch.forEach(product => {
                emitProductCreated(io, product);
                results.insertedProducts.push(product._id);
            });
            
            results.successCount += insertedBatch.length;
        } catch (error) {
            // Handle partial failures
            if (error.writeErrors) {
                results.successCount += error.result.nInserted;
                results.failedCount += error.writeErrors.length;
                
                error.writeErrors.forEach(writeError => {
                    batchErrors.push({
                        row: i + writeError.index + 1,
                        error: writeError.errmsg
                    });
                });
            } else {
                // All failed
                results.failedCount += batchProducts.length;
                batchErrors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        // Add batch errors to results
        results.errors.push(...batchErrors);
    }
    
    res.status(200).json({
        success: true,
        message: `CSV upload completed. ${results.successCount} products created, ${results.failedCount} failed.`,
        ...results
    });
});