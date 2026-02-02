const ErrorHandler = require('../utils/errorHandler');
const Category = require('../models/categoryModel');

// Validate category creation
exports.validateCategoryCreation = async (req, res, next) => {
    const { name, description } = req.body;
    
    // Required fields validation
    if (!name || name.trim().length === 0) {
        return next(new ErrorHandler("Category name is required", 400));
    }
    
    // Trim name
    const trimmedName = name.trim();
    
    // Check if category with this name already exists (case insensitive)
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });
    
    if (existingCategory) {
        return next(new ErrorHandler(`Category with name "${trimmedName}" already exists`, 400));
    }
    
    // Name length validation
    if (trimmedName.length > 100) {
        return next(new ErrorHandler("Category name must be less than 100 characters", 400));
    }
    
    // Description length validation (optional field)
    if (description && description.length > 500) {
        return next(new ErrorHandler("Category description must be less than 500 characters", 400));
    }
    
    // Sanitize and prepare data
    req.body.name = trimmedName;
    req.body.description = description ? description.trim() : "";
    
    next();
};

// Validate category update
exports.validateCategoryUpdate = async (req, res, next) => {
    const { name, description } = req.body;
    
    // If name is provided, validate it
    if (name !== undefined) {
        const trimmedName = name.trim();
        
        if (trimmedName.length === 0) {
            return next(new ErrorHandler("Category name cannot be empty", 400));
        }
        
        // Name length validation
        if (trimmedName.length > 100) {
            return next(new ErrorHandler("Category name must be less than 100 characters", 400));
        }
        
        // Check if another category with this name already exists (case insensitive)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: req.params.id }
        });
        
        if (existingCategory) {
            return next(new ErrorHandler(`Category with name "${trimmedName}" already exists`, 400));
        }
        
        req.body.name = trimmedName;
    }
    
    // If description is provided, validate it
    if (description !== undefined) {
        if (description.length > 500) {
            return next(new ErrorHandler("Category description must be less than 500 characters", 400));
        }
        req.body.description = description.trim();
    }
    
    next();
};