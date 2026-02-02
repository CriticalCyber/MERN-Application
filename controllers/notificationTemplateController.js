const NotificationTemplate = require('../models/notificationTemplateModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');

// Get All Notification Templates ---ADMIN
exports.getAllTemplates = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    const type = req.query.type;
    const channel = req.query.channel;
    const isActive = req.query.isActive;
    
    // Build filter object
    let filter = {};
    
    if (type) {
        filter.type = sanitizeInput(type);
    }
    
    if (channel) {
        filter.channel = sanitizeInput(channel);
    }
    
    if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
    }
    
    // Count total templates
    const templatesCount = await NotificationTemplate.countDocuments(filter);
    
    // Apply pagination and sorting
    const templates = await NotificationTemplate.find(filter)
        .sort({ createdAt: -1 })
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .lean();

    res.status(200).json({
        success: true,
        templates,
        templatesCount,
        resultPerPage,
        currentPage,
    });
});

// Get Notification Template Details ---ADMIN
exports.getTemplate = asyncErrorHandler(async (req, res, next) => {
    const template = await NotificationTemplate.findById(req.params.id).lean();

    if (!template) {
        return next(new ErrorHandler("Template not found", 404));
    }

    res.status(200).json({
        success: true,
        template,
    });
});

// Create Notification Template ---ADMIN
exports.createTemplate = asyncErrorHandler(async (req, res, next) => {
    // Sanitize inputs
    req.body.name = sanitizeInput(req.body.name);
    req.body.subject = sanitizeInput(req.body.subject);
    req.body.message = sanitizeInput(req.body.message);
    req.body.type = sanitizeInput(req.body.type);
    req.body.channel = sanitizeInput(req.body.channel);
    
    if (req.body.variables) {
        req.body.variables = req.body.variables.map(variable => ({
            name: sanitizeInput(variable.name),
            description: sanitizeInput(variable.description)
        }));
    }

    const template = await NotificationTemplate.create(req.body);

    res.status(201).json({
        success: true,
        template
    });
});

// Update Notification Template ---ADMIN
exports.updateTemplate = asyncErrorHandler(async (req, res, next) => {
    let template = await NotificationTemplate.findById(req.params.id);

    if (!template) {
        return next(new ErrorHandler("Template not found", 404));
    }

    // Sanitize inputs
    if (req.body.name) req.body.name = sanitizeInput(req.body.name);
    if (req.body.subject) req.body.subject = sanitizeInput(req.body.subject);
    if (req.body.message) req.body.message = sanitizeInput(req.body.message);
    if (req.body.type) req.body.type = sanitizeInput(req.body.type);
    if (req.body.channel) req.body.channel = sanitizeInput(req.body.channel);
    if (req.body.isActive !== undefined) req.body.isActive = req.body.isActive;
    
    if (req.body.variables) {
        req.body.variables = req.body.variables.map(variable => ({
            name: sanitizeInput(variable.name),
            description: sanitizeInput(variable.description)
        }));
    }

    template = await NotificationTemplate.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
        template
    });
});

// Delete Notification Template ---ADMIN
exports.deleteTemplate = asyncErrorHandler(async (req, res, next) => {
    const template = await NotificationTemplate.findById(req.params.id);

    if (!template) {
        return next(new ErrorHandler("Template not found", 404));
    }

    await template.remove();

    res.status(200).json({
        success: true,
        message: "Template deleted successfully"
    });
});

// Toggle Template Active Status ---ADMIN
exports.toggleTemplateStatus = asyncErrorHandler(async (req, res, next) => {
    const template = await NotificationTemplate.findById(req.params.id);

    if (!template) {
        return next(new ErrorHandler("Template not found", 404));
    }

    template.isActive = !template.isActive;
    await template.save();

    res.status(200).json({
        success: true,
        message: `Template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
        template
    });
});