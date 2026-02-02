const Category = require('../models/categoryModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Removed Cloudinary dependency
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import socket event emitters for cache invalidation
const { emitCategoryCreated, emitCategoryUpdated, emitCategoryDeleted } = require('../utils/socketEvents');
// Import cache manager
const { invalidateCache } = require('../utils/cacheManager');
// Import S3 utilities for hybrid storage
const { uploadToS3, deleteFromS3, isS3Image, isLocalImage } = require('../utils/s3Upload');
// Import production-safe logger
const logger = require('../utils/logger');

// Helper function to convert relative image URLs to absolute URLs
const convertRelativeImageUrls = (categories) => {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4001}`;
    
    return categories.map(category => {
        if (category.image && category.image.url && category.image.url.startsWith('/uploads/')) {
            category.image.url = `${backendUrl}${category.image.url}`;
        }
        return category;
    });
};

// Check if S3 uploads are enabled
const isS3Enabled = () => {
    return process.env.ENABLE_S3_UPLOADS === 'true';
};

// Using local storage for images (when S3 is disabled)
const isLocalStorageEnabled = () => {
    return !isS3Enabled(); // Local storage is enabled when S3 is not enabled
};

// Get All Categories ---ADMIN
exports.getAllCategories = asyncErrorHandler(async (req, res, next) => {
    // Debug logging to verify session data
    logger.debug(`ADMIN CATEGORY API HIT - Query: ${JSON.stringify(req.query)}`);
    
    const resultPerPage = Number(req.query.limit) || 20;
    // Allow fetching all categories for admin panel with special parameter
    const maxLimit = req.query.all === 'true' ? 1000 : 100;
    const actualLimit = req.query.all === 'true' ? 1000 : Math.min(resultPerPage, maxLimit);
    const currentPage = Number(req.query.page) || 1;
    
    // Validate pagination parameters
    if (req.query.all !== 'true' && resultPerPage > 100) {
        return next(new ErrorHandler("Limit cannot exceed 100", 400));
    }
    
    if (currentPage < 1) {
        return next(new ErrorHandler("Page must be greater than 0", 400));
    }
    
    // Build filter object for counting
    const filter = {};
    if (req.query.enabled !== undefined) {
        filter.isEnabled = req.query.enabled === 'true';
    }
    
    // Use estimatedDocumentCount for better performance when no filters
    let categoriesCount;
    if (Object.keys(filter).length === 0) {
        categoriesCount = await Category.estimatedDocumentCount();
    } else {
        categoriesCount = await Category.countDocuments(filter);
    }
    
    // Calculate safe skip value to prevent skipping past total documents
    const skipAmount = Math.max(0, Math.min(actualLimit * (currentPage - 1), Math.max(0, categoriesCount - 1)));
    
    // Apply pagination with filters
    const categories = await Category.find(filter)
        .select('name description image subCategories isEnabled createdAt')
        .sort({ createdAt: -1 })
        .limit(actualLimit)
        .skip(skipAmount)
        .lean();
        
    // Convert relative image URLs to absolute URLs
    const processedCategories = convertRelativeImageUrls(categories);
    
    logger.debug(`Categories found: ${processedCategories.length}`);
    
    // Add memory usage logging for monitoring
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    if (heapUsedMB > 800) { // Log if memory usage is high
        logger.warn(`High memory usage detected in getAllCategories: ${heapUsedMB}MB`);
    }
    
    logger.debug(`Sending response with categories count: ${processedCategories.length}`);

    res.status(200).json({
        success: true,
        categories: processedCategories,
        categoriesCount,
        resultPerPage: actualLimit,
        currentPage,
        // Include memory stats in response for debugging
        memoryStats: {
            heapUsed: heapUsedMB,
            rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100
        }
    });
});

// Get Public Categories (only enabled ones)
exports.getPublicCategories = asyncErrorHandler(async (req, res, next) => {
    const categories = await Category.find({ isEnabled: true })
        .select('name image updatedAt createdAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

    // Convert relative image URLs to absolute URLs for public categories
    const processedCategories = convertRelativeImageUrls(categories);
    
    res.status(200).json({
        success: true,
        categories: processedCategories,
    });
});

// Get Category Details ---ADMIN
exports.getCategory = asyncErrorHandler(async (req, res, next) => {
    const category = await Category.findById(req.params.id).select('-__v').lean();

    if (!category) {
        return next(new ErrorHandler("Category not found", 404));
    }

    // Convert relative image URL to absolute URL for category details
    const processedCategory = convertRelativeImageUrls([category])[0];
    
    res.status(200).json({
        success: true,
        category: processedCategory,
    });
});

// Create Category ---ADMIN
exports.createCategory = asyncErrorHandler(async (req, res, next) => {
    logger.debug(`REQ.BODY: ${JSON.stringify(req.body)}`);
    logger.debug(`REQ.FILE: ${req.file ? 'present' : 'missing'}`);
    
    // Validate required fields with proper checks
    if (!req.body.name || typeof req.body.name !== "string" || req.body.name === "undefined" || req.body.name.trim() === "") {
        return next(new ErrorHandler("Category name is required and must be a non-empty string", 400));
    }
    
    // Validate that image file is present if no existing image path is provided
    if (!req.file) {
        return next(new ErrorHandler("Category image file is required", 400));
    }
    
    // Sanitize inputs
    req.body.name = sanitizeInput(req.body.name);
    req.body.description = sanitizeInput(req.body.description);
    
    // Sanitize subCategories array
    if (req.body.subCategories && Array.isArray(req.body.subCategories)) {
        req.body.subCategories = req.body.subCategories.map(subCat => ({
            name: sanitizeInput(subCat.name),
            description: sanitizeInput(subCat.description || "")
        }));
    }

    // Handle image upload - using hybrid storage (S3 or local)
    let imageData = {
        public_id: 'placeholder_category',
        url: '/uploads/categories/default-category.png',
    };
    
    if (req.file) {
        const imageFile = req.file;
        
        if (!imageFile) {
            return next(new ErrorHandler('Invalid file: file object is missing', 400));
        }
        
        const imagePath = imageFile.url || imageFile.path;
        
        if (!imagePath) {
            return next(new ErrorHandler('Invalid file: no usable image path found', 400));
        }
        
        // Use S3 data if available, otherwise use local file path
        if (imageFile.url && imageFile.key) {
            // S3 upload already completed by hybridUploadSingle
            imageData = {
                key: imageFile.key,
                public_id: imageFile.public_id || imageFile.key, // For backward compatibility
                url: imageFile.url
            };
        } else if (imageFile.path) {
            // Local storage path
            imageData = {
                key: imageFile.filename || imageFile.originalname, // Use filename as key
                public_id: imageFile.filename || imageFile.originalname, // Use filename as public_id
                url: imageFile.path.replace(/^.*uploads/, '/uploads'), // Convert to relative URL for frontend access
            };
        }
        
        logger.info(`CATEGORY IMAGE SAVED: ${imagePath}`);
    }

    req.body.image = imageData;

    const category = await Category.create(req.body);
    
    // Emit socket event for category creation
    const io = req.app.get('io');
    emitCategoryCreated(io, category.toJSON());
    
    // Invalidate cache
    await invalidateCache('categories');

    // Convert relative image URL to absolute URL for new category
    const processedCategory = convertRelativeImageUrls([category])[0];
    
    res.status(201).json({
        success: true,
        category: processedCategory
    });
});

// Update Category ---ADMIN
exports.updateCategory = asyncErrorHandler(async (req, res, next) => {
    let category = await Category.findById(req.params.id);

    if (!category) {
        return next(new ErrorHandler("Category not found", 404));
    }

    // Validate required fields if name is being updated
    if (req.body.name !== undefined && (req.body.name === "undefined" || !req.body.name.trim())) {
        return next(new ErrorHandler("Category name cannot be empty", 400));
    }

    // Sanitize inputs
    if (req.body.name) req.body.name = sanitizeInput(req.body.name);
    if (req.body.description) req.body.description = sanitizeInput(req.body.description);
    
    // Sanitize subCategories array
    if (req.body.subCategories && Array.isArray(req.body.subCategories)) {
        req.body.subCategories = req.body.subCategories.map(subCat => ({
            name: sanitizeInput(subCat.name),
            description: sanitizeInput(subCat.description || "")
        }));
    }

    // Handle image update
    logger.debug(`UPDATE FILE: ${req.file ? 'present' : 'missing'}`);
    
    if (req.file) {
        // Delete old S3 image if exists
        if (category.image && category.image.key && isS3Image(category.image.url)) {
            try {
                await deleteFromS3(category.image.key);
                logger.info(`Deleted old S3 category image: ${category.image.key}`);
            } catch (error) {
                logger.error(`Error deleting old S3 category image: ${error.message}`);
                // Continue with update even if S3 deletion fails
            }
        }
        
        const imageFile = req.file;
        
        if (!imageFile) {
            return next(new ErrorHandler('Invalid file: file object is missing', 400));
        }
        
        const imagePath = imageFile.url || imageFile.path;
        
        if (!imagePath) {
            return next(new ErrorHandler('Invalid file: no usable image path found', 400));
        }
        
        // Use S3 data if available, otherwise use local file path
        if (imageFile.url && imageFile.key) {
            // S3 upload already completed by hybridUploadSingle
            req.body.image = {
                key: imageFile.key,
                public_id: imageFile.public_id || imageFile.key, // For backward compatibility
                url: imageFile.url
            };
        } else if (imageFile.path) {
            // Local storage path
            req.body.image = {
                key: imageFile.filename || imageFile.originalname, // Use filename as key
                public_id: imageFile.filename || imageFile.originalname,
                url: imageFile.path.replace(/^.*uploads/, '/uploads'), // Store relative URL like createCategory
            };
        }
        
        logger.info(`CATEGORY IMAGE SAVED: ${imagePath}`);
    } else {
        // If no new image is provided, keep the existing image
        if (category.image) {
            req.body.image = category.image; // Preserve existing image
        }
    }

    // Ensure updatedAt is updated
    req.body.updatedAt = Date.now();
    
    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });
    
    // Emit socket event for category update
    const io = req.app.get('io');
    emitCategoryUpdated(io, category.toJSON());
    
    // Invalidate cache
    await invalidateCache('categories');

    // Convert relative image URL to absolute URL for updated category
    const processedCategory = convertRelativeImageUrls([category])[0];
    
    res.status(200).json({
        success: true,
        category: processedCategory
    });
});

// Delete Category ---ADMIN
exports.deleteCategory = asyncErrorHandler(async (req, res, next) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return next(new ErrorHandler("Category not found", 404));
    }

    // Check if category has S3 images that need to be deleted
    if (category.image && category.image.key && isS3Image(category.image.url)) {
        try {
            await deleteFromS3(category.image.key);
        } catch (error) {
            logger.error(`Error deleting S3 category image: ${error.message}`);
            // Continue with deletion even if S3 deletion fails
        }
    }

    await category.remove();
    
    // Emit socket event for category deletion
    const io = req.app.get('io');
    emitCategoryDeleted(io, req.params.id);
    
    // Invalidate cache
    await invalidateCache('categories');

    res.status(200).json({
        success: true,
        message: "Category deleted successfully"
    });
});

// Toggle Category Status ---ADMIN
exports.toggleCategoryStatus = asyncErrorHandler(async (req, res, next) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return next(new ErrorHandler("Category not found", 404));
    }

    category.isEnabled = !category.isEnabled;
    category.updatedAt = Date.now();
    await category.save();
    
    // Emit socket event for category status toggle
    const io = req.app.get('io');
    emitCategoryUpdated(io, category.toJSON());
    
    // Invalidate cache
    await invalidateCache('categories');

    // Convert relative image URL to absolute URL for updated category
    const processedCategory = convertRelativeImageUrls([category])[0];
    
    res.status(200).json({
        success: true,
        message: `Category ${category.isEnabled ? 'enabled' : 'disabled'} successfully`,
        category: processedCategory
    });
});