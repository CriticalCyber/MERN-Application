const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Inventory = require('../models/inventoryModel');
const TaxRate = require('../models/taxRateModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const SearchFeatures = require('../utils/searchFeatures');
const ErrorHandler = require('../utils/errorHandler');
const inventoryService = require('../services/inventoryService');
// Removed Cloudinary dependency
// Import socket event emitters
const { 
    emitProductCreated, 
    emitProductUpdated, 
    emitProductDeleted, 
    emitStockUpdated 
} = require('../utils/socketEvents');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import version check middleware
const checkVersion = require('../middlewares/versionCheck');
// Import cache manager
const { invalidateCache } = require('../utils/cacheManager');
// Import image processor
const { processImage } = require('../utils/imageProcessor');
// Import S3 utilities for hybrid storage
const { uploadToS3, deleteFromS3, isS3Image, isLocalImage } = require('../utils/s3Upload');

// Import production-safe logger
const logger = require('../utils/logger');

// Check if S3 uploads are enabled
const isS3Enabled = () => {
    return process.env.ENABLE_S3_UPLOADS === 'true';
};

// Using local storage for images (when S3 is disabled)
const isLocalStorageEnabled = () => {
    return !isS3Enabled(); // Local storage is enabled when S3 is not enabled
};

// Get All Products
exports.getAllProducts = asyncErrorHandler(async (req, res, next) => {

    const resultPerPage = Number(req.query.limit) || 24;
    const currentPage = Number(req.query.page) || 1;
    
    // Check if status filter is applied
    const { status } = req.query;
    
    if (status) {
        // Handle status filtering with inventory join
        let matchQuery = {};
        
        // Apply other filters
        if (req.query.keyword) {
            matchQuery.$text = { $search: req.query.keyword };
        }
        
        if (req.query.category) {
            // Handle category filtering
            const Category = require('../models/categoryModel');
            let categoryFilter;
            if (mongoose.Types.ObjectId.isValid(req.query.category)) {
                categoryFilter = mongoose.Types.ObjectId(req.query.category);
            } else {
                const category = await Category.findOne({
                    $or: [
                        { name: { $regex: new RegExp(`^${req.query.category}$`, 'i') } },
                        { slug: { $regex: new RegExp(`^${req.query.category}$`, 'i') } }
                    ]
                });
                categoryFilter = category ? category._id : mongoose.Types.ObjectId('000000000000000000000000');
            }
            matchQuery.category = categoryFilter;
        }
        
        // Apply price filter
        if (req.query.price && req.query.price.gte !== undefined && req.query.price.lte !== undefined) {
            matchQuery.price = { $gte: req.query.price.gte, $lte: req.query.price.lte };
        }
        
        // Apply ratings filter
        if (req.query.ratings && req.query.ratings.gte !== undefined) {
            matchQuery.ratings = { $gte: req.query.ratings.gte };
        }
        
        // Add active product filter
        matchQuery.is_active = true;
        
        // Build aggregation pipeline with inventory join
        const pipeline = [
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'inventories',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'inventory'
                }
            },
            {
                $addFields: {
                    // Use inventory quantity if available, otherwise use product stock
                    effectiveStock: {
                        $cond: {
                            if: { $gt: [{ $size: "$inventory" }, 0] },
                            then: { $arrayElemAt: ["$inventory.quantityAvailable", 0] },
                            else: "$stock"
                        }
                    }
                }
            },
            // Apply status filter based on effective stock
            {
                $match: {
                    $expr: {
                        $cond: {
                            if: { $eq: [req.query.status, 'in-stock'] },
                            then: { $gt: ["$effectiveStock", 0] },
                            else: { 
                                $cond: {
                                    if: { $eq: [req.query.status, 'out-of-stock'] },
                                    then: { $eq: ["$effectiveStock", 0] },
                                    else: true
                                }
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $addFields: {
                    category: { $arrayElemAt: ['$category', 0] }
                }
            },
            {
                $project: {
                    name: 1,
                    price: 1,
                    images: 1,
                    brand: 1,
                    category: { name: 1 },
                    stock: 1,
                    ratings: 1,
                    numOfReviews: 1,
                    effectiveStock: 0,
                    inventory: 0
                }
            },
            { $skip: (currentPage - 1) * resultPerPage },
            { $limit: resultPerPage }
        ];
        
        const products = await Product.aggregate(pipeline);
        
        // Count total products with status filter
        const countPipeline = [
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'inventories',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'inventory'
                }
            },
            {
                $addFields: {
                    effectiveStock: {
                        $cond: {
                            if: { $gt: [{ $size: "$inventory" }, 0] },
                            then: { $arrayElemAt: ["$inventory.quantityAvailable", 0] },
                            else: "$stock"
                        }
                    }
                }
            },
            {
                $match: {
                    $expr: {
                        $cond: {
                            if: { $eq: [req.query.status, 'in-stock'] },
                            then: { $gt: ["$effectiveStock", 0] },
                            else: { 
                                $cond: {
                                    if: { $eq: [req.query.status, 'out-of-stock'] },
                                    then: { $eq: ["$effectiveStock", 0] },
                                    else: true
                                }
                            }
                        }
                    }
                }
            },
            {
                $count: 'total'
            }
        ];
        
        const countResultArray = await Product.aggregate(countPipeline);
        const countResult = countResultArray.length > 0 ? countResultArray[0].total : 0;
        
        res.status(200).json({
            success: true,
            products,
            productsCount: countResult,
            resultPerPage,
            currentPage,
            filteredProductsCount: countResult,
        });
    } else {
        // Use original search features for non-status filtering
        // Build filter object for counting
        const searchFeatureCount = new SearchFeatures(Product.find(), req.query);
        await searchFeatureCount.search();
        await searchFeatureCount.prepareFilters();
        searchFeatureCount.filter();
        
        const productsCount = await Product.countDocuments(searchFeatureCount.query.getFilter());
        const filteredProductsCount = await Product.countDocuments(searchFeatureCount.query.getFilter());

        // Apply search, filter and pagination
        const searchFeature = new SearchFeatures(Product.find().select('name price images brand category stock ratings numOfReviews').lean(), req.query);
        await searchFeature.search();
        await searchFeature.prepareFilters();
        searchFeature.filter().pagination(resultPerPage);

        const products = await searchFeature.query.populate('category', 'name').exec();

        res.status(200).json({
            success: true,
            products,
            productsCount,
            resultPerPage,
            currentPage,
            filteredProductsCount,
        });
    }
})

// Get All Products ---Product Sliders
exports.getProducts = asyncErrorHandler(async (req, res, next) => {
    // Limit product sliders to improve performance
    const products = await Product.find({}, { name: 1, price: 1, images: { $slice: 1 }, brand: 1, category: 1, stock: 1, ratings: 1, numOfReviews: 1 })
        .populate('category', 'name slug')
        .limit(50)
        .sort({ createdAt: -1 })
        .lean();

    res.status(200).json({
        success: true,
        products,
    });
})
// Get Products by Category
exports.getProductsByCategory = asyncErrorHandler(async (req, res, next) => {
    const categorySlug = req.params.slug;
    
    // Find category by slug (case-insensitive)
    const category = await Category.findOne({ 
        slug: { $regex: new RegExp(`^${categorySlug}$`, 'i') }
    });
    
    if (!category) {
        return next(new ErrorHandler("Category not found", 404));
    }
    
    // Get products by category ObjectId
    const resultPerPage = Number(req.query.limit) || 24;
    const currentPage = Number(req.query.page) || 1;
    
    const products = await Product.find({ category: category._id, is_active: true })
        .select('name price images brand category stock ratings numOfReviews')
        .populate('category', 'name slug')
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .sort({ createdAt: -1 })
        .lean();
    
    const productsCount = await Product.countDocuments({ category: category._id, is_active: true });
    
    res.status(200).json({
        success: true,
        products,
        productsCount,
        resultPerPage,
        currentPage,
        category
    });
});

// Get Product Details
exports.getProductDetails = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id).select('-__v').lean();

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        product,
    });
})

// Get All Products ---ADMIN
exports.getAdminProducts = asyncErrorHandler(async (req, res, next) => {
    // Debug logging to verify session data
    logger.debug(`Admin accessing products - Admin ID: ${req.admin._id}`);
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    
    // Validate pagination parameters
    if (resultPerPage > 200) {
        return next(new ErrorHandler("Limit cannot exceed 200", 400));
    }
    
    if (currentPage < 1) {
        return next(new ErrorHandler("Page must be greater than 0", 400));
    }
    
    // For admin products, we want to show ALL products without additional filtering
    // Build base query without applying user filters that might limit results
    let baseQuery = Product.find();
    
    // Apply search if keyword is provided (but no additional filtering for admin)
    if (req.query.keyword) {
        baseQuery = baseQuery.find({ $text: { $search: req.query.keyword } });
    }
    
    // Count total products for pagination (considering only search if provided)
    let productsCount;
    if (req.query.keyword) {
        productsCount = await Product.countDocuments({ $text: { $search: req.query.keyword } });
    } else {
        productsCount = await Product.countDocuments();
    }
    
    // Apply pagination and sort
    const skipProducts = resultPerPage * (currentPage - 1);
    
    // Get products with their inventory data
    const products = await baseQuery
        .select('name images brand category price cuttedPrice stock createdAt ratings numOfReviews')
        .populate('category', 'name')
        .sort({ createdAt: -1 }) // Sort by creation date for better performance
        .skip(skipProducts)
        .limit(resultPerPage)
        .lean()
        .exec();
    
    // Get inventory data for all products in this batch
    const productIds = products.map(p => p._id);
    const inventories = await Inventory.find({ product: { $in: productIds } })
        .select('product quantityAvailable quantityReserved')
        .lean();
    
    // Create a map of inventory data by product ID
    const inventoryMap = {};
    inventories.forEach(inv => {
        inventoryMap[inv.product.toString()] = inv;
    });
    
    // Add inventory quantity to each product
    const productsWithInventory = products.map(product => {
        const inventory = inventoryMap[product._id.toString()];
        return {
            ...product,
            // Use inventory quantity if available, otherwise fallback to product stock
            stock: inventory ? inventory.quantityAvailable : product.stock,
            // Add inventory-specific fields
            inventoryId: inventory ? inventory._id : null,
            quantityReserved: inventory ? inventory.quantityReserved : 0
        };
    });
    
    // Add memory usage logging for monitoring
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    if (heapUsedMB > 800) { // Log if memory usage is high
        logger.warn(`High memory usage detected in getAdminProducts: ${heapUsedMB}MB`);
    }

    // Calculate if there are more products to load
    const hasMore = (currentPage * resultPerPage) < productsCount;

    res.status(200).json({
        success: true,
        products: productsWithInventory,
        productsCount,
        resultPerPage,
        currentPage,
        hasMore,
        // Include memory stats in response for debugging
        memoryStats: {
            heapUsed: heapUsedMB,
            rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100
        }
    });
})

// Create Product ---ADMIN
exports.createProduct = asyncErrorHandler(async (req, res, next) => {
    // Safely normalize req.body.name to handle multer behavior with multipart/form-data
    // Handle array values (["Apple"]), trim whitespace, and reject empty values
    let name = req.body.name;
    if (Array.isArray(name)) {
        name = name[0]; // Take first element if it's an array
    }
    if (typeof name === 'string') {
        name = name.trim(); // Trim whitespace
    }
    // Reassign the normalized value back to req.body.name
    req.body.name = name;
    
    // Now validate the normalized name
    const { sku } = req.body;
    if (!name) {
        return next(new ErrorHandler("Product name is required", 400));
    }

    // Log request admin for debugging
    logger.debug(`Product creation request by admin: ${req.admin._id}`);
    
    // Sanitize inputs
    req.body.name = sanitizeInput(name);
    req.body.description = sanitizeInput(req.body.description);
    req.body.brandname = sanitizeInput(req.body.brandname);
    
    // Handle category - trim whitespace and normalize
    let categoryName = req.body.category ? req.body.category.trim() : '';
    categoryName = sanitizeInput(categoryName);
    
    // Validate category
    if (!categoryName) {
        return next(new ErrorHandler("Category is required", 400));
    }
    
    // Check if category is numeric only
    if (/^\d+$/.test(categoryName)) {
        return next(new ErrorHandler("Category cannot be numeric only", 400));
    }
    
    // Auto-generate SKU if not provided
    if (!sku) {
        // Generate SKU based on product name and timestamp
        const namePart = name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const timestampPart = Date.now().toString().slice(-6);
        req.body.sku = `${namePart}${timestampPart}`;
    } else {
        req.body.sku = sku;
    }
    
    // Find existing category (case insensitive)
    let category;
    try {
        category = await Category.findOne({
            name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });
        
        // If category doesn't exist, return error
        if (!category) {
            return next(new ErrorHandler(`Category '${categoryName}' does not exist. Please create the category first.`, 400));
        }
    } catch (err) {
        return next(new ErrorHandler("Error processing category", 500));
    }
    
    req.body.category = category._id;
    
    // Sanitize highlights array
    if (req.body.highlights && Array.isArray(req.body.highlights)) {
        req.body.highlights = req.body.highlights.map(highlight => sanitizeInput(highlight));
    }
    
    // Sanitize specifications array
    if (req.body.specifications && Array.isArray(req.body.specifications)) {
        req.body.specifications = req.body.specifications.map(spec => {
            if (typeof spec === 'string') {
                try {
                    const parsedSpec = JSON.parse(spec);
                    return JSON.stringify({
                        title: sanitizeInput(parsedSpec.title),
                        description: sanitizeInput(parsedSpec.description)
                    });
                } catch (e) {
                    return spec;
                }
            }
            return spec;
        });
    }

    // Handle images from multer - using hybrid storage (S3 or local)
    if (req.files && req.files.images) {
        const imagesLink = [];
        for (const file of req.files.images) {
            if (isS3Enabled()) {
                // Upload to S3
                try {
                    const result = await uploadToS3(file, "products");
                    imagesLink.push({
                        public_id: result.key,
                        url: result.url,
                    });
                } catch (error) {
                    console.error('S3 Upload Error:', error);
                    // Fallback to local storage if S3 fails
                    if (isLocalStorageEnabled()) {
                        try {
                            // Process image to create thumbnail
                            await processImage(file.path, file.filename);
                            imagesLink.push({
                                public_id: file.filename, // Use filename as public_id
                                url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                                thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                            });
                        } catch (localError) {
                            // If processing fails, use original image
                            imagesLink.push({
                                public_id: file.filename, // Use filename as public_id
                                url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                            });
                        }
                    } else {
                        // If both S3 and local storage fail, return error
                        return next(new ErrorHandler(`Failed to upload image: ${error.message}`, 500));
                    }
                }
            } else if (isLocalStorageEnabled()) {
                // Process locally stored images and create thumbnails
                try {
                    // Process image to create thumbnail
                    await processImage(file.path, file.filename);
                    imagesLink.push({
                        public_id: file.filename, // Use filename as public_id
                        url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                        thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                    });
                } catch (error) {
                    // If processing fails, use original image
                    imagesLink.push({
                        public_id: file.filename, // Use filename as public_id
                        url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                    });
                }
            }
        }
        req.body.images = imagesLink;
    } else {
        // Use placeholder images if no files uploaded
        imagesLink.push({
            public_id: 'placeholder',
            url: '/uploads/products/default-product.png',
        });
    }

    // Handle brand logo - using hybrid storage (S3 or local)
    let brandLogo = {
        public_id: 'placeholder_brand',
        url: '/uploads/products/default-brand.png',
    };
    
    if (req.files && req.files.logo && req.files.logo.length > 0) {
        const logoFile = req.files.logo[0];
        
        if (isS3Enabled()) {
            // Upload to S3
            try {
                const result = await uploadToS3(logoFile, "products");
                brandLogo = {
                    public_id: result.key,
                    url: result.url,
                };
            } catch (error) {
                console.error('S3 Logo Upload Error:', error);
                // Fallback to local storage if S3 fails
                if (isLocalStorageEnabled()) {
                    try {
                        // Process image to create thumbnail
                        await processImage(logoFile.path, logoFile.filename);
                        brandLogo = {
                            public_id: logoFile.filename, // Use filename as public_id
                            url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                            thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                        };
                    } catch (localError) {
                        // If processing fails, use original image
                        brandLogo = {
                            public_id: logoFile.filename, // Use filename as public_id
                            url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                        };
                    }
                } else {
                    // If both S3 and local storage fail, return error
                    return next(new ErrorHandler(`Failed to upload logo: ${error.message}`, 500));
                }
            }
        } else if (isLocalStorageEnabled()) {
            // Process locally stored brand logo
            try {
                // Process image to create thumbnail
                await processImage(logoFile.path, logoFile.filename);
                brandLogo = {
                    public_id: logoFile.filename, // Use filename as public_id
                    url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                    thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                };
            } catch (error) {
                // If processing fails, use original image
                brandLogo = {
                    public_id: logoFile.filename, // Use filename as public_id
                    url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                };
            }
        }
    }

    req.body.brand = {
        name: req.body.brandname,
        logo: brandLogo
    }
    req.body.images = imagesLink;
    
    // Ensure admin ID is properly set for admin-created products
    req.body.admin = req.admin._id;
    // Clear user field for admin-created products to avoid confusion
    delete req.body.user;
    


    // Safeguard specifications to prevent crashes
    let specs = [];
    if (req.body.specifications && Array.isArray(req.body.specifications)) {
        try {
            req.body.specifications.forEach((s) => {
                specs.push(JSON.parse(s))
            });
        } catch (parseError) {
            console.error('Error parsing specifications:', parseError);
            // Continue with empty specs array if parsing fails
        }
    }
    req.body.specifications = specs;

    try {
        const product = await Product.create(req.body);
        
        // Create inventory record for the new product
        // Initialize with the stock value from the request or default to 0
        const initialStock = req.body.stock || 0;
        const inventory = await inventoryService.addStock(
            product._id,
            initialStock,
            `Initial stock for product ${product.name}`,
            req.admin._id,
            'Product creation - initial stock'
        );
        
        // Emit socket event for product creation
        const io = req.app.get('io');
        emitProductCreated(io, product.toJSON());
        
        // Emit socket event for stock update
        emitStockUpdated(io, {
            _id: product._id,
            name: product.name,
            sku: inventory.sku,
            quantityAvailable: inventory.quantityAvailable,
            quantityReserved: inventory.quantityReserved
        });
        
        // Invalidate cache
        await invalidateCache('products');

        res.status(201).json({
            success: true,
            product
        });
    } catch (dbError) {
        logger.error(`Database error during product creation: ${dbError.message}`);
        return next(new ErrorHandler("Failed to create product in database", 500));
    }
});

// Update Product ---ADMIN
exports.updateProduct = asyncErrorHandler(async (req, res, next) => {

    let product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    // Debug logs
    logger.debug(`Update product request - Product ID: ${req.params.id}, Body keys: ${Object.keys(req.body).join(', ')}, Files: ${req.files ? req.files.length : 0}`);

    // Check if we have any data to update
    if (!req.body && !req.files) {
        return next(new ErrorHandler("No data provided for update", 400));
    }

    // Sanitize inputs
    if (req.body.name) req.body.name = sanitizeInput(req.body.name);
    if (req.body.description) req.body.description = sanitizeInput(req.body.description);
    if (req.body.brandname) req.body.brandname = sanitizeInput(req.body.brandname);
    
    // Handle category update if provided
    if (req.body.category) {
        let categoryId = req.body.category.trim();
        categoryId = sanitizeInput(categoryId);
        
        // Validate category - check if it's a valid ObjectId first
        if (mongoose.Types.ObjectId.isValid(categoryId)) {
            // It's already an ObjectId, check if it exists
            const category = await Category.findById(categoryId);
            if (!category) {
                logger.warn(`Invalid category ID for product ${product._id}, skipping category update`);
                // Remove category from update to avoid error
                delete req.body.category;
            }
            // If category exists, req.body.category is already set correctly
        } else {
            // It's not an ObjectId, treat it as category name
            const category = await Category.findOne({
                name: { $regex: new RegExp(`^${categoryId}$`, 'i') }
            });
            
            if (!category) {
                logger.warn(`Category '${categoryId}' does not exist for product ${product._id}, skipping category update`);
                // Remove category from update to avoid error
                delete req.body.category;
            } else {
                req.body.category = category._id;
            }
        }
    }
    
    // Sanitize highlights array
    if (req.body.highlights && Array.isArray(req.body.highlights)) {
        req.body.highlights = req.body.highlights.map(highlight => sanitizeInput(highlight));
    }
    
    // Sanitize specifications array
    if (req.body.specifications && Array.isArray(req.body.specifications)) {
        req.body.specifications = req.body.specifications.map(spec => {
            if (typeof spec === 'string') {
                try {
                    const parsedSpec = JSON.parse(spec);
                    return JSON.stringify({
                        title: sanitizeInput(parsedSpec.title),
                        description: sanitizeInput(parsedSpec.description)
                    });
                } catch (e) {
                    return spec;
                }
            }
            return spec;
        });
    }

    // Check version for optimistic locking
    if (req.body.__v !== undefined && product.__v !== req.body.__v) {
        return next(new ErrorHandler("Product has been modified by another user. Please refresh and try again.", 409));
    }

    // Handle images from multer - using hybrid storage (S3 or local)
    if (req.files && req.files.images && Array.isArray(req.files.images) && req.files.images.length > 0) {
        const imagesLink = [];
        for (const file of req.files.images) {
            if (isS3Enabled()) {
                // Upload to S3
                try {
                    const result = await uploadToS3(file, "products");
                    imagesLink.push({
                        public_id: result.key,
                        url: result.url,
                    });
                } catch (error) {
                    console.error('S3 Upload Error:', error);
                    // Fallback to local storage if S3 fails
                    if (isLocalStorageEnabled()) {
                        try {
                            // Process image to create thumbnail
                            await processImage(file.path, file.filename);
                            imagesLink.push({
                                public_id: file.filename, // Use filename as public_id
                                url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                                thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                            });
                        } catch (localError) {
                            // If processing fails, use original image
                            imagesLink.push({
                                public_id: file.filename, // Use filename as public_id
                                url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                            });
                        }
                    } else {
                        // If both S3 and local storage fail, return error
                        return next(new ErrorHandler(`Failed to upload image: ${error.message}`, 500));
                    }
                }
            } else if (isLocalStorageEnabled()) {
                // Process locally stored images and create thumbnails
                try {
                    // Process image to create thumbnail
                    await processImage(file.path, file.filename);
                    imagesLink.push({
                        public_id: file.filename, // Use filename as public_id
                        url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                        thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                    });
                } catch (error) {
                    // If processing fails, use original image
                    imagesLink.push({
                        public_id: file.filename, // Use filename as public_id
                        url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                    });
                }
            }
        }
        
        // Delete old S3 images if new images are being uploaded
        if (product.images && Array.isArray(product.images)) {
            for (const oldImage of product.images) {
                if (oldImage.public_id && isS3Image(oldImage.url)) {
                    try {
                        await deleteFromS3(oldImage.public_id);
                        logger.info(`Deleted old S3 image: ${oldImage.public_id}`);
                    } catch (error) {
                        logger.error(`Error deleting old S3 image: ${error.message}`);
                        // Continue with update even if S3 deletion fails
                    }
                }
            }
        }
        
        // Replace images instead of appending
        req.body.images = imagesLink;
    }

    // Handle brand logo from multer - using hybrid storage (S3 or local)
    if (req.files && req.files.logo && req.files.logo.length > 0) {
        const logoFile = req.files.logo[0];
        let brandLogo;
        
        // Delete old S3 logo if exists
        if (product.brand && product.brand.logo && product.brand.logo.public_id && isS3Image(product.brand.logo.url)) {
            try {
                await deleteFromS3(product.brand.logo.public_id);
                logger.info(`Deleted old S3 logo: ${product.brand.logo.public_id}`);
            } catch (error) {
                logger.error(`Error deleting old S3 logo: ${error.message}`);
                // Continue with update even if S3 deletion fails
            }
        }
        
        if (isS3Enabled()) {
            // Upload to S3
            try {
                const result = await uploadToS3(logoFile, "products");
                brandLogo = {
                    public_id: result.key,
                    url: result.url,
                };
            } catch (error) {
                console.error('S3 Logo Upload Error:', error);
                // Fallback to local storage if S3 fails
                if (isLocalStorageEnabled()) {
                    try {
                        // Process image to create thumbnail
                        await processImage(logoFile.path, logoFile.filename);
                        brandLogo = {
                            public_id: logoFile.filename, // Use filename as public_id
                            url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                            thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                        };
                    } catch (localError) {
                        // If processing fails, use original image
                        brandLogo = {
                            public_id: logoFile.filename, // Use filename as public_id
                            url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                        };
                    }
                } else {
                    // If both S3 and local storage fail, return error
                    return next(new ErrorHandler(`Failed to upload logo: ${error.message}`, 500));
                }
            }
        } else if (isLocalStorageEnabled()) {
            // Process locally stored brand logo
            try {
                // Process image to create thumbnail
                await processImage(logoFile.path, logoFile.filename);
                brandLogo = {
                    public_id: logoFile.filename, // Use filename as public_id
                    url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                    thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                };
            } catch (error) {
                // If processing fails, use original image
                brandLogo = {
                    public_id: logoFile.filename, // Use filename as public_id
                    url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                };
            }
        }

        req.body.brand = {
            name: req.body.brandname,
            logo: brandLogo
        }
    }

    // Safeguard specifications to prevent crashes
    let specs = [];
    if (req.body.specifications && Array.isArray(req.body.specifications)) {
        try {
            req.body.specifications.forEach((s) => {
                specs.push(JSON.parse(s))
            });
        } catch (parseError) {
            console.error('Error parsing specifications:', parseError);
            // Continue with empty specs array if parsing fails
        }
    }
    req.body.specifications = specs;
    // Ensure admin ID is properly set for admin-updated products
    req.body.admin = req.admin._id;
    // Clear user field for admin-updated products to avoid confusion
    delete req.body.user;

    // Validate tax rate if provided
    if (req.body.taxRateId) {
        const taxRate = await TaxRate.findById(req.body.taxRateId);
        if (!taxRate) {
            return next(new ErrorHandler("Invalid tax rate selected", 400));
        }
        
        if (!taxRate.isActive) {
            return next(new ErrorHandler("Selected tax rate is not active", 400));
        }
    }
    
    // Prepare update data
    const updateData = {};
    
    // Copy all body fields to update data
    Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
            updateData[key] = req.body[key];
        }
    });
    
    // Handle file uploads
    if (req.files) {
        // Handle images from multer - using hybrid storage (S3 or local)
        if (req.files.images) {
            const imagesLink = [];
            for (const file of req.files.images) {
                if (isS3Enabled()) {
                    // Upload to S3
                    try {
                        const result = await uploadToS3(file, "products");
                        imagesLink.push({
                            public_id: result.key,
                            url: result.url,
                        });
                    } catch (error) {
                        console.error('S3 Upload Error:', error);
                        // Fallback to local storage if S3 fails
                        if (isLocalStorageEnabled()) {
                            try {
                                // Process image to create thumbnail
                                await processImage(file.path, file.filename);
                                imagesLink.push({
                                    public_id: file.filename, // Use filename as public_id
                                    url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                                    thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                                });
                            } catch (localError) {
                                // If processing fails, use original image
                                imagesLink.push({
                                    public_id: file.filename, // Use filename as public_id
                                    url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                                });
                            }
                        } else {
                            // If both S3 and local storage fail, return error
                            return next(new ErrorHandler(`Failed to upload image: ${error.message}`, 500));
                        }
                    }
                } else if (isLocalStorageEnabled()) {
                    // Process locally stored images and create thumbnails
                    try {
                        // Process image to create thumbnail
                        await processImage(file.path, file.filename);
                        imagesLink.push({
                            public_id: file.filename, // Use filename as public_id
                            url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                            thumbnail: `/uploads/thumbnails/${file.filename}` // Thumbnail URL
                        });
                    } catch (error) {
                        // If processing fails, use original image
                        imagesLink.push({
                            public_id: file.filename, // Use filename as public_id
                            url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                        });
                    }
                }
            }
                        
            // Delete old S3 images if new images are being uploaded
            if (product.images && Array.isArray(product.images)) {
                for (const oldImage of product.images) {
                    if (oldImage.public_id && isS3Image(oldImage.url)) {
                        try {
                            await deleteFromS3(oldImage.public_id);
                            logger.info(`Deleted old S3 image: ${oldImage.public_id}`);
                        } catch (error) {
                            logger.error(`Error deleting old S3 image: ${error.message}`);
                            // Continue with update even if S3 deletion fails
                        }
                    }
                }
            }
                        
            // Replace images instead of appending
            updateData.images = imagesLink;
        }

        // Handle brand logo from multer - using hybrid storage (S3 or local)
        if (req.files.logo && req.files.logo.length > 0) {
            const logoFile = req.files.logo[0];
            let brandLogo;
            
            // Delete old S3 logo if exists
            if (product.brand && product.brand.logo && product.brand.logo.public_id && isS3Image(product.brand.logo.url)) {
                try {
                    await deleteFromS3(product.brand.logo.public_id);
                    logger.info(`Deleted old S3 logo: ${product.brand.logo.public_id}`);
                } catch (error) {
                    logger.error(`Error deleting old S3 logo: ${error.message}`);
                    // Continue with update even if S3 deletion fails
                }
            }
            
            if (isS3Enabled()) {
                // Upload to S3
                try {
                    const result = await uploadToS3(logoFile, "products");
                    brandLogo = {
                        public_id: result.key,
                        url: result.url,
                    };
                } catch (error) {
                    console.error('S3 Logo Upload Error:', error);
                    // Fallback to local storage if S3 fails
                    if (isLocalStorageEnabled()) {
                        try {
                            // Process image to create thumbnail
                            await processImage(logoFile.path, logoFile.filename);
                            brandLogo = {
                                public_id: logoFile.filename, // Use filename as public_id
                                url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                                thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                            };
                        } catch (localError) {
                            // If processing fails, use original image
                            brandLogo = {
                                public_id: logoFile.filename, // Use filename as public_id
                                url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                            };
                        }
                    } else {
                        // If both S3 and local storage fail, return error
                        return next(new ErrorHandler(`Failed to upload logo: ${error.message}`, 500));
                    }
                }
            } else if (isLocalStorageEnabled()) {
                // Process locally stored brand logo
                try {
                    // Process image to create thumbnail
                    await processImage(logoFile.path, logoFile.filename);
                    brandLogo = {
                        public_id: logoFile.filename, // Use filename as public_id
                        url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                        thumbnail: `/uploads/thumbnails/${logoFile.filename}` // Thumbnail URL
                    };
                } catch (error) {
                    // If processing fails, use original image
                    brandLogo = {
                        public_id: logoFile.filename, // Use filename as public_id
                        url: `/uploads/products/${logoFile.filename}`, // Relative URL for frontend access
                    };
                }
            }

            updateData.brand = {
                name: req.body.brandname || (product.brand ? product.brand.name : ''),
                logo: brandLogo
            }
        }
    }
    
    // Safeguard specifications to prevent crashes
    if (updateData.specifications && Array.isArray(updateData.specifications)) {
        let specs = [];
        try {
            updateData.specifications.forEach((s) => {
                specs.push(JSON.parse(s))
            });
        } catch (parseError) {
            console.error('Error parsing specifications:', parseError);
            // Continue with empty specs array if parsing fails
        }
        updateData.specifications = specs;
    }
    
    // Add admin ID
    updateData.admin = req.admin._id;
    // Clear user field for admin-updated products to avoid confusion
    delete updateData.user;
    
    // Use findByIdAndUpdate with proper options to ensure update happens
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });
    
    // Check if product was actually updated
    if (!updatedProduct) {
        return next(new ErrorHandler("Product update failed. Please try again.", 500));
    }
    
    // Emit socket event for product update
    const io = req.app.get('io');
    emitProductUpdated(io, updatedProduct.toJSON());
    
    // Invalidate cache
    await invalidateCache('products');

    res.status(200).json({
        success: true,
        product: updatedProduct
    });
});

// Delete Product ---ADMIN
exports.deleteProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    // Check version for optimistic locking
    if (req.body.__v !== undefined && product.__v !== req.body.__v) {
        return next(new ErrorHandler("Product has been modified by another user. Please refresh and try again.", 409));
    }

    // Check if product has S3 images that need to be deleted
    if (product.images && Array.isArray(product.images)) {
        for (const image of product.images) {
            if (image.public_id && isS3Image(image.url)) {
                try {
                    await deleteFromS3(image.public_id);
                } catch (error) {
                    console.error('Error deleting S3 product image:', error);
                    // Continue with deletion even if S3 deletion fails
                }
            }
        }
    }
    
    // Check if product brand logo is from S3 and needs deletion
    if (product.brand && product.brand.logo && product.brand.logo.public_id && isS3Image(product.brand.logo.url)) {
        try {
            await deleteFromS3(product.brand.logo.public_id);
        } catch (error) {
            console.error('Error deleting S3 product brand logo:', error);
            // Continue with deletion even if S3 deletion fails
        }
    }

    await product.remove();
    
    // Emit socket event for product deletion
    const io = req.app.get('io');
    emitProductDeleted(io, req.params.id);
    
    // Invalidate cache
    await invalidateCache('products');

    res.status(201).json({
        success: true
    });
});

// Create OR Update Reviews
exports.createProductReview = asyncErrorHandler(async (req, res, next) => {

    const { rating, comment, productId } = req.body;

    // Sanitize comment
    const sanitizedComment = sanitizeInput(comment);

    const review = {
        user: req.user._id,
        name: req.user.name,
        rating: Number(rating),
        comment: sanitizedComment,
    }

    const product = await Product.findById(productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const isReviewed = product.reviews.find(review => review.user.toString() === req.user._id.toString());

    if (isReviewed) {

        product.reviews.forEach((rev) => { 
            if (rev.user.toString() === req.user._id.toString())
                (rev.rating = rating, rev.comment = sanitizedComment);
        });
    } else {
        product.reviews.push(review);
        product.numOfReviews = product.reviews.length;
    }

    let avg = 0;

    product.reviews.forEach((rev) => {
        avg += rev.rating;
    });

    product.ratings = avg / product.reviews.length;

    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true
    });
});

// Get All Reviews of Product
exports.getProductReviews = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.id).select('reviews').lean();

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        reviews: product.reviews
    });
});

// Upload Additional Images ---ADMIN
exports.uploadAdditionalImages = asyncErrorHandler(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product not found", 404));
    }

    // Handle additional images upload - using hybrid storage (S3 or local)
    let additionalImages = [];
    
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            if (isS3Enabled()) {
                // Upload to S3
                try {
                    const result = await uploadToS3(file, "products");
                    additionalImages.push({
                        public_id: result.key,
                        url: result.url,
                    });
                } catch (error) {
                    console.error('S3 Additional Image Upload Error:', error);
                    // Fallback to local storage if S3 fails
                    if (isLocalStorageEnabled()) {
                        additionalImages.push({
                            public_id: file.filename, // Use filename as public_id
                            url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                        });
                    } else {
                        // If both S3 and local storage fail, return error
                        return next(new ErrorHandler(`Failed to upload additional image: ${error.message}`, 500));
                    }
                }
            } else if (isLocalStorageEnabled()) {
                // Use local storage
                additionalImages.push({
                    public_id: file.filename, // Use filename as public_id
                    url: `/uploads/products/${file.filename}`, // Relative URL for frontend access
                });
            }
        }
    }

    // Add new images to existing additional_images array
    product.additional_images = [...(product.additional_images || []), ...additionalImages];
    
    await product.save();
    
    // Emit socket event for product update
    const io = req.app.get('io');
    emitProductUpdated(io, product.toJSON());
    
    // Invalidate cache
    await invalidateCache('products');

    res.status(200).json({
        success: true,
        product
    });
});

// Delete Reveiws
exports.deleteReview = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const reviews = product.reviews.filter((rev) => rev._id.toString() !== req.query.id.toString());

    let avg = 0;

    reviews.forEach((rev) => {
        avg += rev.rating;
    });

    let ratings = 0;

    if (reviews.length === 0) {
        ratings = 0;
    } else {
        ratings = avg / reviews.length;
    }

    const numOfReviews = reviews.length;

    const updatedProduct = await Product.findByIdAndUpdate(req.query.productId, {
        reviews,
        ratings: Number(ratings),
        numOfReviews,
    }, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
    });
});

// Get Related Products
exports.getRelatedProducts = asyncErrorHandler(async (req, res, next) => {
    const productId = req.params.id;
    
    // Find the current product
    const currentProduct = await Product.findById(productId);
    
    if (!currentProduct) {
        return next(new ErrorHandler("Product Not Found", 404));
    }
    
    let relatedProducts = [];
    
    // First, try to find products in the same category
    if (currentProduct.category) {
        relatedProducts = await Product.find({
            category: currentProduct.category,
            _id: { $ne: currentProduct._id },
            isActive: true
        })
        .select('name price images brand cuttedPrice ratings numOfReviews stock')
        .limit(8)
        .lean();
    }
    
    // If not enough products in the same category, try by brand
    if (relatedProducts.length < 6 && currentProduct.brand && currentProduct.brand.name) {
        const brandRelated = await Product.find({
            'brand.name': currentProduct.brand.name,
            _id: { $ne: currentProduct._id },
            isActive: true,
            category: { $ne: currentProduct.category }
        })
        .select('name price images brand cuttedPrice ratings numOfReviews stock')
        .limit(8 - relatedProducts.length)
        .lean();
        
        relatedProducts = [...relatedProducts, ...brandRelated];
    }
    
    // If still not enough products, get recent products
    if (relatedProducts.length < 6) {
        const recentProducts = await Product.find({
            _id: { $nin: [...relatedProducts.map(p => p._id), currentProduct._id] },
            isActive: true
        })
        .select('name price images brand cuttedPrice ratings numOfReviews stock')
        .sort({ createdAt: -1 })
        .limit(8 - relatedProducts.length)
        .lean();
        
        relatedProducts = [...relatedProducts, ...recentProducts];
    }
    
    res.status(200).json({
        success: true,
        relatedProducts
    });
});