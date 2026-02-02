const ErrorHandler = require('../utils/errorHandler');

// Validate add stock request
exports.validateAddStock = (req, res, next) => {
    const { productId, quantity, reference } = req.body;
    
    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }
    
    if (!quantity || quantity <= 0) {
        return next(new ErrorHandler("Quantity must be a positive number", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Ensure quantity is an integer
    req.body.quantity = parseInt(quantity);
    
    next();
};

// Validate remove stock request
exports.validateRemoveStock = (req, res, next) => {
    const { productId, quantity, reference } = req.body;
    
    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }
    
    if (!quantity || quantity <= 0) {
        return next(new ErrorHandler("Quantity must be a positive number", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Ensure quantity is an integer
    req.body.quantity = parseInt(quantity);
    
    next();
};

// Validate adjust stock request
exports.validateAdjustStock = (req, res, next) => {
    const { productId, quantity, reference } = req.body;
    
    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }
    
    if (quantity === undefined || quantity < 0) {
        return next(new ErrorHandler("Quantity must be a non-negative number", 400));
    }
    
    if (!reference) {
        return next(new ErrorHandler("Reference is required", 400));
    }
    
    // Ensure quantity is an integer
    req.body.quantity = parseInt(quantity);
    
    next();
};

// Validate product SKU uniqueness
exports.validateProductSKU = async (req, res, next) => {
    const Product = require('../models/productModel');
    
    const { sku } = req.body;
    
    if (!sku) {
        return next(new ErrorHandler("SKU is required", 400));
    }
    
    // Check if SKU already exists (for create operations)
    if (req.method === 'POST') {
        const existingProduct = await Product.findOne({ sku });
        if (existingProduct) {
            return next(new ErrorHandler(`Product with SKU ${sku} already exists`, 400));
        }
    }
    
    // For update operations, check if we're changing to an existing SKU
    if (req.method === 'PUT' && req.params.id) {
        const product = await Product.findById(req.params.id);
        if (product && product.sku !== sku) {
            const existingProduct = await Product.findOne({ sku });
            if (existingProduct) {
                return next(new ErrorHandler(`Product with SKU ${sku} already exists`, 400));
            }
        }
    }
    
    next();
};

// Validate inventory integrity
exports.validateInventoryIntegrity = async (req, res, next) => {
    const Product = require('../models/productModel');
    const Inventory = require('../models/inventoryModel');
    
    const { productId } = req.body;
    
    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        return next(new ErrorHandler("Product not found", 404));
    }
    
    // For remove operations, check if enough stock is available
    if (req.path.includes('remove-stock') || req.path.includes('reserve-stock')) {
        const { quantity } = req.body;
        const inventory = await Inventory.findOne({ product: productId });
        
        if (!inventory) {
            return next(new ErrorHandler("Inventory record not found for this product", 404));
        }
        
        if (inventory.quantityAvailable < quantity) {
            return next(new ErrorHandler(`Insufficient stock. Available: ${inventory.quantityAvailable}, Requested: ${quantity}`, 400));
        }
    }
    
    next();
};