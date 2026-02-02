const ErrorHandler = require('../utils/errorHandler');
const Product = require('../models/productModel');
const TaxRate = require('../models/taxRateModel');

// Validate product creation
exports.validateProductCreation = async (req, res, next) => {

    // Normalize multipart fields
    if (req.body.name && Array.isArray(req.body.name)) {
        req.body.name = req.body.name[0];
    }

    // 🔴 CRITICAL FIX: trim before validation
    if (typeof req.body.name === "string") {
        req.body.name = req.body.name.trim();
    }
    
    const { name, sku, price, description, category, stock, taxRateId } = req.body;
    
    // Required fields validation
    if (!name || name.length === 0) {
        return next(new ErrorHandler("Product name is required", 400));
    }
    
    if (!price) {
        return next(new ErrorHandler("Product price is required", 400));
    }
    
    if (!description) {
        return next(new ErrorHandler("Product description is required", 400));
    }
    
    if (!category) {
        return next(new ErrorHandler("Product category is required", 400));
    }
    
    if (stock === undefined || stock === null) {
        return next(new ErrorHandler("Product stock is required", 400));
    }
    
    if (!taxRateId) {
        return next(new ErrorHandler("Tax rate is required", 400));
    }
    
    // Validate tax rate exists and is active
    const taxRate = await TaxRate.findById(taxRateId);
    if (!taxRate) {
        return next(new ErrorHandler("Invalid tax rate selected", 400));
    }
    
    if (!taxRate.isActive) {
        return next(new ErrorHandler("Selected tax rate is not active", 400));
    }
    
    // Auto-generate SKU if not provided
    let productSku = sku;
    if (!productSku) {
        // Generate SKU based on product name and timestamp
        const namePart = name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const timestampPart = Date.now().toString().slice(-6);
        productSku = `${namePart}${timestampPart}`;
    }
    
    // Price validation
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return next(new ErrorHandler("Product price must be a positive number", 400));
    }
    
    // Stock validation
    const parsedStock = parseInt(stock);
    if (isNaN(parsedStock) || parsedStock < 0) {
        return next(new ErrorHandler("Product stock must be a non-negative integer", 400));
    }
    
    // SKU uniqueness validation
    const existingProduct = await Product.findOne({ sku: productSku });
    if (existingProduct) {
        return next(new ErrorHandler(`Product with SKU ${productSku} already exists`, 400));
    }
    
    // Sanitize and prepare data
    req.body.sku = productSku;
    req.body.price = parsedPrice;
    req.body.stock = parsedStock;
    req.body.cuttedPrice = req.body.cuttedPrice ? parseFloat(req.body.cuttedPrice) : parsedPrice;
    
    next();
};

// Validate product update
exports.validateProductUpdate = async (req, res, next) => {
    const { name, sku, price, description, category, taxRateId } = req.body;
    
    // If price is provided, validate it
    if (price !== undefined) {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return next(new ErrorHandler("Product price must be a positive number", 400));
        }
        req.body.price = parsedPrice;
    }
    
    // If cuttedPrice is provided, validate it
    if (req.body.cuttedPrice !== undefined) {
        const parsedCuttedPrice = parseFloat(req.body.cuttedPrice);
        if (isNaN(parsedCuttedPrice) || parsedCuttedPrice <= 0) {
            return next(new ErrorHandler("Product cutted price must be a positive number", 400));
        }
        req.body.cuttedPrice = parsedCuttedPrice;
    }
    
    // If SKU is provided, check uniqueness (but allow keeping the same SKU)
    if (sku) {
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