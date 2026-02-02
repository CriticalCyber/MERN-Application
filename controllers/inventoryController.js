const Product = require('../models/productModel');
const Inventory = require('../models/inventoryModel');
const InventoryTransaction = require('../models/inventoryTransactionModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const inventoryService = require('../services/inventoryService');
// Import socket event emitters
const { emitStockUpdated } = require('../utils/socketEvents');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import admin alerts
const { sendInventoryLowAlert } = require('../utils/adminAlerts');

// Get Inventory Summary ---ADMIN
exports.getInventorySummary = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    const lowStockThreshold = Number(req.query.lowStockThreshold) || 10;
    
    // Build aggregation pipeline for inventory summary
    const pipeline = [
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'productData.category',
                foreignField: 'name',
                as: 'categoryData'
            }
        },
        {
            $unwind: {
                path: '$categoryData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                product: '$productData',
                sku: 1,
                quantityAvailable: 1,
                quantityReserved: 1,
                reorderLevel: 1,
                lastUpdated: 1,
                stockValue: {
                    $multiply: ['$productData.price', '$quantityAvailable']
                },
                isLowStock: {
                    $and: [
                        { $gt: ['$quantityAvailable', 0] },
                        { $lte: ['$quantityAvailable', lowStockThreshold] }
                    ]
                },
                isOutOfStock: {
                    $eq: ['$quantityAvailable', 0]
                }
            }
        }
    ];
    
    // Add category filter if provided
    if (req.query.category) {
        pipeline.push({
            $match: {
                'product.category': req.query.category
            }
        });
    }
    
    // Add brand filter if provided
    if (req.query.brand) {
        pipeline.push({
            $match: {
                'product.brand.name': req.query.brand
            }
        });
    }
    
    // Add sorting
    pipeline.push({
        $sort: { quantityAvailable: 1 }
    });
    
    // Add pagination
    pipeline.push(
        { $skip: resultPerPage * (currentPage - 1) },
        { $limit: resultPerPage }
    );
    
    // Execute aggregation
    const inventories = await Inventory.aggregate(pipeline);
    
    // Get total count
    const totalCountPipeline = [
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        }
    ];
    
    // Add filters to count pipeline
    if (req.query.category) {
        totalCountPipeline.push({
            $match: {
                'productData.category': req.query.category
            }
        });
    }
    
    if (req.query.brand) {
        totalCountPipeline.push({
            $match: {
                'productData.brand.name': req.query.brand
            }
        });
    }
    
    totalCountPipeline.push({ $count: 'totalCount' });
    
    const totalCountResult = await Inventory.aggregate(totalCountPipeline);
    const productsCount = totalCountResult.length > 0 ? totalCountResult[0].totalCount : 0;
    
    // Calculate summary metrics
    let totalStockValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    
    // Use for loop for better performance
    for (let i = 0; i < inventories.length; i++) {
        const inventory = inventories[i];
        totalStockValue += inventory.stockValue || 0;
        if (inventory.isOutOfStock) {
            outOfStockItems++;
        } else if (inventory.isLowStock) {
            lowStockItems++;
        }
    }

    res.status(200).json({
        success: true,
        inventories,
        productsCount,
        resultPerPage,
        currentPage,
        summary: {
            totalStockValue,
            lowStockItems,
            outOfStockItems,
            lowStockThreshold
        }
    });
});

// Get Low Stock Items ---ADMIN
exports.getLowStockItems = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    const lowStockThreshold = Number(req.query.threshold) || 10;
    
    // Build aggregation pipeline for low stock items
    const pipeline = [
        {
            $match: {
                quantityAvailable: { $gt: 0, $lte: lowStockThreshold }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        },
        {
            $project: {
                _id: '$productData._id',
                name: '$productData.name',
                images: '$productData.images',
                brand: '$productData.brand',
                category: '$productData.category',
                price: '$productData.price',
                quantityAvailable: 1,
                quantityReserved: 1,
                reorderLevel: 1,
                lastUpdated: 1
            }
        }
    ];
    
    // Add category filter if provided
    if (req.query.category) {
        pipeline.push({
            $match: {
                'productData.category': req.query.category
            }
        });
    }
    
    // Add brand filter if provided
    if (req.query.brand) {
        pipeline.push({
            $match: {
                'productData.brand.name': req.query.brand
            }
        });
    }
    
    // Add sorting
    pipeline.push({
        $sort: { quantityAvailable: 1 }
    });
    
    // Add pagination
    pipeline.push(
        { $skip: resultPerPage * (currentPage - 1) },
        { $limit: resultPerPage }
    );
    
    // Execute aggregation
    const lowStockItems = await Inventory.aggregate(pipeline);
    
    // Get total count
    const countPipeline = [
        {
            $match: {
                quantityAvailable: { $gt: 0, $lte: lowStockThreshold }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        }
    ];
    
    // Add filters to count pipeline
    if (req.query.category) {
        countPipeline.push({
            $match: {
                'productData.category': req.query.category
            }
        });
    }
    
    if (req.query.brand) {
        countPipeline.push({
            $match: {
                'productData.brand.name': req.query.brand
            }
        });
    }
    
    countPipeline.push({ $count: 'totalCount' });
    
    const countResult = await Inventory.aggregate(countPipeline);
    const productsCount = countResult.length > 0 ? countResult[0].totalCount : 0;

    res.status(200).json({
        success: true,
        lowStockItems,
        productsCount,
        resultPerPage,
        currentPage
    });
});

// Get Out of Stock Items ---ADMIN
exports.getOutOfStockItems = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    
    // Build aggregation pipeline for out of stock items
    const pipeline = [
        {
            $match: {
                quantityAvailable: 0
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        },
        {
            $project: {
                _id: '$productData._id',
                name: '$productData.name',
                images: '$productData.images',
                brand: '$productData.brand',
                category: '$productData.category',
                price: '$productData.price',
                cuttedPrice: '$productData.cuttedPrice',
                quantityAvailable: 1,
                quantityReserved: 1,
                reorderLevel: 1,
                lastUpdated: 1
            }
        }
    ];
    
    // Add category filter if provided
    if (req.query.category) {
        pipeline.push({
            $match: {
                'productData.category': req.query.category
            }
        });
    }
    
    // Add brand filter if provided
    if (req.query.brand) {
        pipeline.push({
            $match: {
                'productData.brand.name': req.query.brand
            }
        });
    }
    
    // Add sorting
    pipeline.push({
        $sort: { lastUpdated: -1 }
    });
    
    // Add pagination
    pipeline.push(
        { $skip: resultPerPage * (currentPage - 1) },
        { $limit: resultPerPage }
    );
    
    // Execute aggregation
    const outOfStockItems = await Inventory.aggregate(pipeline);
    
    // Get total count
    const countPipeline = [
        {
            $match: {
                quantityAvailable: 0
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productData'
            }
        },
        {
            $unwind: '$productData'
        }
    ];
    
    // Add filters to count pipeline
    if (req.query.category) {
        countPipeline.push({
            $match: {
                'productData.category': req.query.category
            }
        });
    }
    
    if (req.query.brand) {
        countPipeline.push({
            $match: {
                'productData.brand.name': req.query.brand
            }
        });
    }
    
    countPipeline.push({ $count: 'totalCount' });
    
    const countResult = await Inventory.aggregate(countPipeline);
    const productsCount = countResult.length > 0 ? countResult[0].totalCount : 0;

    res.status(200).json({
        success: true,
        outOfStockItems,
        productsCount,
        resultPerPage,
        currentPage
    });
});

// Add Stock to Inventory ---ADMIN
exports.addStock = asyncErrorHandler(async (req, res, next) => {
    const { productId, quantity, reference, notes } = req.body;
    
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        return next(new ErrorHandler("Product ID and positive quantity are required", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Sanitize inputs
    const sanitizedProductId = sanitizeInput(productId);
    const sanitizedQuantity = parseInt(quantity);
    const sanitizedReference = sanitizeInput(reference);
    const sanitizedNotes = notes ? sanitizeInput(notes) : '';
    
    try {
        // Add stock using inventory service
        const inventory = await inventoryService.addStock(
            sanitizedProductId, 
            sanitizedQuantity, 
            sanitizedReference, 
            req.user._id, 
            sanitizedNotes
        );
        
        // Get product details for response
        const product = await Product.findById(sanitizedProductId);
        
        if (!product) {
            return next(new ErrorHandler("Product not found", 404));
        }
        
        // Emit socket event for stock update
        const io = req.app.get('io');
        emitStockUpdated(io, {
            _id: product._id,
            name: product.name,
            sku: inventory.sku,
            quantityAvailable: inventory.quantityAvailable,
            quantityReserved: inventory.quantityReserved
        });
        
        // Send admin alert if stock is low
        if (inventory.quantityAvailable <= inventory.reorderLevel && inventory.quantityAvailable > 0) {
            await sendInventoryLowAlert(io, {
                name: product.name,
                productId: product._id,
                quantity: inventory.quantityAvailable
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Stock added successfully",
            inventory: {
                _id: inventory._id,
                product: inventory.product,
                sku: inventory.sku,
                quantityAvailable: inventory.quantityAvailable,
                quantityReserved: inventory.quantityReserved,
                reorderLevel: inventory.reorderLevel,
                lastUpdated: inventory.lastUpdated
            }
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// Remove Stock from Inventory ---ADMIN
exports.removeStock = asyncErrorHandler(async (req, res, next) => {
    const { productId, quantity, reference, notes } = req.body;
    
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        return next(new ErrorHandler("Product ID and positive quantity are required", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Sanitize inputs
    const sanitizedProductId = sanitizeInput(productId);
    const sanitizedQuantity = parseInt(quantity);
    const sanitizedReference = sanitizeInput(reference);
    const sanitizedNotes = notes ? sanitizeInput(notes) : '';
    
    try {
        // Remove stock using inventory service
        const inventory = await inventoryService.removeStock(
            sanitizedProductId, 
            sanitizedQuantity, 
            sanitizedReference, 
            req.user._id, 
            sanitizedNotes
        );
        
        // Get product details for response
        const product = await Product.findById(sanitizedProductId);
        
        if (!product) {
            return next(new ErrorHandler("Product not found", 404));
        }
        
        // Emit socket event for stock update
        const io = req.app.get('io');
        emitStockUpdated(io, {
            _id: product._id,
            name: product.name,
            sku: inventory.sku,
            quantityAvailable: inventory.quantityAvailable,
            quantityReserved: inventory.quantityReserved
        });
        
        res.status(200).json({
            success: true,
            message: "Stock removed successfully",
            inventory: {
                _id: inventory._id,
                product: inventory.product,
                sku: inventory.sku,
                quantityAvailable: inventory.quantityAvailable,
                quantityReserved: inventory.quantityReserved,
                reorderLevel: inventory.reorderLevel,
                lastUpdated: inventory.lastUpdated
            }
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// Adjust Stock Manually ---ADMIN
exports.adjustStock = asyncErrorHandler(async (req, res, next) => {
    const { productId, quantity, reference, notes } = req.body;
    
    // Validate inputs
    if (!productId || quantity === undefined) {
        return next(new ErrorHandler("Product ID and quantity are required", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Sanitize inputs
    const sanitizedProductId = sanitizeInput(productId);
    const sanitizedQuantity = parseInt(quantity);
    const sanitizedReference = sanitizeInput(reference);
    const sanitizedNotes = notes ? sanitizeInput(notes) : '';
    
    try {
        // Adjust stock using inventory service
        const inventory = await inventoryService.adjustStock(
            sanitizedProductId, 
            sanitizedQuantity, 
            sanitizedReference, 
            req.user._id, 
            sanitizedNotes
        );
        
        // Get product details for response
        const product = await Product.findById(sanitizedProductId);
        
        if (!product) {
            return next(new ErrorHandler("Product not found", 404));
        }
        
        // Emit socket event for stock update
        const io = req.app.get('io');
        emitStockUpdated(io, {
            _id: product._id,
            name: product.name,
            sku: inventory.sku,
            quantityAvailable: inventory.quantityAvailable,
            quantityReserved: inventory.quantityReserved
        });
        
        // Send admin alert if stock is low
        if (inventory.quantityAvailable <= inventory.reorderLevel && inventory.quantityAvailable > 0) {
            await sendInventoryLowAlert(io, {
                name: product.name,
                productId: product._id,
                quantity: inventory.quantityAvailable
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Stock adjusted successfully",
            inventory: {
                _id: inventory._id,
                product: inventory.product,
                sku: inventory.sku,
                quantityAvailable: inventory.quantityAvailable,
                quantityReserved: inventory.quantityReserved,
                reorderLevel: inventory.reorderLevel,
                lastUpdated: inventory.lastUpdated
            }
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// Get Inventory Transactions ---ADMIN
exports.getInventoryTransactions = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    const productId = req.query.productId;
    const transactionType = req.query.type;
    
    // Build filter
    const filter = {};
    if (productId) {
        filter.product = productId;
    }
    if (transactionType) {
        filter.type = transactionType;
    }
    
    // Count total transactions
    const transactionsCount = await InventoryTransaction.countDocuments(filter);
    
    // Get transactions with product details
    const transactions = await InventoryTransaction.find(filter)
        .populate('product', 'name sku')
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .lean();

    res.status(200).json({
        success: true,
        transactions,
        transactionsCount,
        resultPerPage,
        currentPage
    });
});

// Get Inventory Details for a Product ---ADMIN
exports.getProductInventory = asyncErrorHandler(async (req, res, next) => {
    const productId = req.params.productId;
    
    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }
    
    // Get inventory details
    const inventory = await Inventory.findOne({ product: productId })
        .populate('product', 'name sku price category brand')
        .lean();
    
    if (!inventory) {
        return next(new ErrorHandler("Inventory record not found for this product", 404));
    }
    
    // Get recent transactions
    const recentTransactions = await InventoryTransaction.find({ product: productId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    
    res.status(200).json({
        success: true,
        inventory,
        recentTransactions
    });
});