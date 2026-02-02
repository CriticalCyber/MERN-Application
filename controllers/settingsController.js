const Settings = require('../models/settingsModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Removed Cloudinary dependency
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import socket event emitters
const { emitSettingsUpdated } = require('../utils/socketEvents');
// Import cache manager
const { invalidateCache } = require('../utils/cacheManager');

// Get Store Settings ---ADMIN
exports.getStoreSettings = asyncErrorHandler(async (req, res, next) => {
    let settings = await Settings.findOne().sort({ createdAt: -1 }).lean();
    
    // If no settings exist, create default settings
    if (!settings) {
        settings = await Settings.create({
            storeName: "ShubhValueCart",
            storeDescription: "Your one-stop grocery shop",
            storeAddress: {
                street: "123 Main Street",
                city: "New Delhi",
                state: "Delhi",
                pincode: "110001",
                country: "India"
            },
            contactEmail: "info@shubhvaluecart.com",
            contactPhone: "+91 9876543210"
        });
    }

    res.status(200).json({
        success: true,
        settings
    });
});

// Update Store Settings ---ADMIN
exports.updateStoreSettings = asyncErrorHandler(async (req, res, next) => {
    let settings = await Settings.findOne().sort({ createdAt: -1 }).lean();
    
    // Sanitize inputs
    if (req.body.storeName) req.body.storeName = sanitizeInput(req.body.storeName);
    if (req.body.storeDescription) req.body.storeDescription = sanitizeInput(req.body.storeDescription);
    if (req.body.contactEmail) req.body.contactEmail = sanitizeInput(req.body.contactEmail);
    if (req.body.contactPhone) req.body.contactPhone = sanitizeInput(req.body.contactPhone);
    
    // Sanitize address fields
    if (req.body.storeAddress) {
        if (req.body.storeAddress.street) req.body.storeAddress.street = sanitizeInput(req.body.storeAddress.street);
        if (req.body.storeAddress.city) req.body.storeAddress.city = sanitizeInput(req.body.storeAddress.city);
        if (req.body.storeAddress.state) req.body.storeAddress.state = sanitizeInput(req.body.storeAddress.state);
        if (req.body.storeAddress.pincode) req.body.storeAddress.pincode = sanitizeInput(req.body.storeAddress.pincode);
        if (req.body.storeAddress.country) req.body.storeAddress.country = sanitizeInput(req.body.storeAddress.country);
    }
    
    // Sanitize social media links
    if (req.body.socialMediaLinks) {
        if (req.body.socialMediaLinks.facebook) req.body.socialMediaLinks.facebook = sanitizeInput(req.body.socialMediaLinks.facebook);
        if (req.body.socialMediaLinks.twitter) req.body.socialMediaLinks.twitter = sanitizeInput(req.body.socialMediaLinks.twitter);
        if (req.body.socialMediaLinks.instagram) req.body.socialMediaLinks.instagram = sanitizeInput(req.body.socialMediaLinks.instagram);
        if (req.body.socialMediaLinks.linkedin) req.body.socialMediaLinks.linkedin = sanitizeInput(req.body.socialMediaLinks.linkedin);
        if (req.body.socialMediaLinks.youtube) req.body.socialMediaLinks.youtube = sanitizeInput(req.body.socialMediaLinks.youtube);
    }
    
    // Sanitize SEO settings
    if (req.body.seoSettings) {
        if (req.body.seoSettings.metaTitle) req.body.seoSettings.metaTitle = sanitizeInput(req.body.seoSettings.metaTitle);
        if (req.body.seoSettings.metaDescription) req.body.seoSettings.metaDescription = sanitizeInput(req.body.seoSettings.metaDescription);
        if (req.body.seoSettings.metaKeywords) req.body.seoSettings.metaKeywords = sanitizeInput(req.body.seoSettings.metaKeywords);
    }

    // If no settings exist, create new settings
    if (!settings) {
        settings = await Settings.create(req.body);
    } else {
        // Handle logo update
        // For local storage implementation, we're not handling store logo updates in this phase
        // Store logo functionality will be handled separately if needed
        
        // Update existing settings
        settings = await Settings.findByIdAndUpdate(
            settings._id,
            { ...req.body, updatedAt: Date.now() },
            {
                new: true,
                runValidators: true,
                useFindAndModify: false
            }
        );
    }
    
    // Emit socket event for settings update
    const io = req.app.get('io');
    emitSettingsUpdated(io, settings);
    
    // Invalidate cache
    await invalidateCache('settings');

    res.status(200).json({
        success: true,
        settings
    });
});

// Get Business Hours ---ADMIN
exports.getBusinessHours = asyncErrorHandler(async (req, res, next) => {
    const settings = await Settings.findOne().select('businessHours').lean();
    
    if (!settings) {
        return next(new ErrorHandler("Settings not found", 404));
    }

    res.status(200).json({
        success: true,
        businessHours: settings.businessHours
    });
});

// Update Business Hours ---ADMIN
exports.updateBusinessHours = asyncErrorHandler(async (req, res, next) => {
    const settings = await Settings.findOne().lean();
    
    if (!settings) {
        return next(new ErrorHandler("Settings not found", 404));
    }

    const updatedSettings = await Settings.findByIdAndUpdate(
        settings._id,
        { businessHours: req.body, updatedAt: Date.now() },
        {
            new: true,
            runValidators: true,
            useFindAndModify: false
        }
    );

    // Emit socket event for settings update
    const io = req.app.get('io');
    emitSettingsUpdated(io, updatedSettings);
    
    // Invalidate cache
    await invalidateCache('settings');
    
    res.status(200).json({
        success: true,
        businessHours: updatedSettings.businessHours
    });
});

// Get Tax Settings ---ADMIN
exports.getTaxSettings = asyncErrorHandler(async (req, res, next) => {
    const settings = await Settings.findOne().select('taxSettings').lean();
    
    if (!settings) {
        return next(new ErrorHandler("Settings not found", 404));
    }

    res.status(200).json({
        success: true,
        taxSettings: settings.taxSettings
    });
});

// Update Tax Settings ---ADMIN
exports.updateTaxSettings = asyncErrorHandler(async (req, res, next) => {
    const settings = await Settings.findOne().lean();
    
    if (!settings) {
        return next(new ErrorHandler("Settings not found", 404));
    }

    const updatedSettings = await Settings.findByIdAndUpdate(
        settings._id,
        { taxSettings: req.body, updatedAt: Date.now() },
        {
            new: true,
            runValidators: true,
            useFindAndModify: false
        }
    );

    // Emit socket event for settings update
    const io = req.app.get('io');
    emitSettingsUpdated(io, updatedSettings);
    
    // Invalidate cache
    await invalidateCache('settings');
    
    res.status(200).json({
        success: true,
        taxSettings: updatedSettings.taxSettings
    });
});