const GiftCard = require('../models/giftCardModel');
const Coupon = require('../models/couponModel');
const PopupEmailLead = require('../models/popupEmailLeadModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');

// Get All Gift Cards ---ADMIN
exports.getAllGiftCards = asyncErrorHandler(async (req, res, next) => {
    const giftCards = await GiftCard.find().select('-__v').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        giftCards,
    });
});

// Get Gift Card Details ---ADMIN
exports.getGiftCard = asyncErrorHandler(async (req, res, next) => {
    const giftCard = await GiftCard.findById(req.params.id).select('-__v').lean();

    if (!giftCard) {
        return next(new ErrorHandler("Gift card not found", 404));
    }

    res.status(200).json({
        success: true,
        giftCard,
    });
});

// Create Gift Card ---ADMIN
exports.createGiftCard = asyncErrorHandler(async (req, res, next) => {
    // Sanitize inputs
    req.body.code = sanitizeInput(req.body.code.toUpperCase());

    const giftCard = await GiftCard.create(req.body);

    res.status(201).json({
        success: true,
        giftCard
    });
});

// Update Gift Card ---ADMIN
exports.updateGiftCard = asyncErrorHandler(async (req, res, next) => {
    let giftCard = await GiftCard.findById(req.params.id);

    if (!giftCard) {
        return next(new ErrorHandler("Gift card not found", 404));
    }

    // Sanitize inputs
    if (req.body.code) req.body.code = sanitizeInput(req.body.code.toUpperCase());

    giftCard = await GiftCard.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
        giftCard
    });
});

// Delete Gift Card ---ADMIN
exports.deleteGiftCard = asyncErrorHandler(async (req, res, next) => {
    const giftCard = await GiftCard.findById(req.params.id);

    if (!giftCard) {
        return next(new ErrorHandler("Gift card not found", 404));
    }

    await giftCard.remove();

    res.status(200).json({
        success: true,
    });
});

// Apply Gift Card
exports.applyGiftCard = asyncErrorHandler(async (req, res, next) => {
    const { code, amount } = req.body;

    // Sanitize input
    const sanitizedCode = sanitizeInput(code.toUpperCase());

    const giftCard = await GiftCard.findOne({
        code: sanitizedCode,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    });

    if (!giftCard) {
        return next(new ErrorHandler("Invalid or expired gift card", 400));
    }

    // Check if gift card has sufficient balance
    if (giftCard.balance < amount) {
        return next(new ErrorHandler(`Insufficient balance. Available balance: ₹${giftCard.balance}`, 400));
    }

    res.status(200).json({
        success: true,
        balance: giftCard.balance,
        giftCard
    });
});

// Use Gift Card
exports.useGiftCard = asyncErrorHandler(async (req, res, next) => {
    const { code, amount, userId } = req.body;

    // Sanitize input
    const sanitizedCode = sanitizeInput(code.toUpperCase());

    const giftCard = await GiftCard.findOne({
        code: sanitizedCode,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    });

    if (!giftCard) {
        return next(new ErrorHandler("Invalid or expired gift card", 400));
    }

    // Check if gift card has sufficient balance
    if (giftCard.balance < amount) {
        return next(new ErrorHandler(`Insufficient balance. Available balance: ₹${giftCard.balance}`, 400));
    }

    // Deduct amount from gift card balance
    giftCard.balance -= amount;
    
    // Add user to usedBy array
    giftCard.usedBy.push({
        user: userId,
        amount: amount
    });

    await giftCard.save();

    res.status(200).json({
        success: true,
        message: "Gift card applied successfully",
        remainingBalance: giftCard.balance,
        giftCard
    });
});

// Get Active Gift Cards for Popup ---PUBLIC
exports.getActiveGiftCardsForPopup = asyncErrorHandler(async (req, res, next) => {
    const giftCards = await GiftCard.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    }).select('-__v -usedBy').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        giftCards,
    });
});

// Get Active Promotions for Popup ---PUBLIC
exports.getActivePromotionsForPopup = asyncErrorHandler(async (req, res, next) => {
    // Get active gift cards
    const giftCards = await GiftCard.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    }).select('-__v -usedBy').sort({ createdAt: -1 }).lean();
    
    // Get active coupons
    const coupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    }).select('-__v').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        promotions: {
            giftCards,
            coupons
        }
    });
});

// Collect Popup Email Lead ---PUBLIC
exports.collectPopupEmailLead = asyncErrorHandler(async (req, res, next) => {
    const { email } = req.body;
    
    // Sanitize input
    const sanitizedEmail = sanitizeInput(email);
    
    // Validate email format
    if (!sanitizedEmail || typeof sanitizedEmail !== 'string' || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(sanitizedEmail)) {
        return next(new ErrorHandler('Please enter a valid email address', 400));
    }
    
    try {
        // Check if email already exists
        const existingLead = await PopupEmailLead.findOne({ email: sanitizedEmail.toLowerCase() });
        
        if (existingLead) {
            return res.status(200).json({
                success: true,
                message: 'Email already exists in our records',
                alreadyExists: true
            });
        }
        
        // Create new email lead
        const emailLead = await PopupEmailLead.create({
            email: sanitizedEmail.toLowerCase(),
            source: 'Popup',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.status(201).json({
            success: true,
            message: 'Email collected successfully',
            emailLead
        });
        
    } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(200).json({
                success: true,
                message: 'Email already exists in our records',
                alreadyExists: true
            });
        }
        
        return next(new ErrorHandler('Error collecting email', 500));
    }
});

// Get Popup Email Leads ---ADMIN
exports.getPopupEmailLeads = asyncErrorHandler(async (req, res, next) => {
    try {
        const leads = await PopupEmailLead.find({})
            .sort({ createdAt: -1 })
            .select('-__v')
            .lean();
        
        res.status(200).json({
            success: true,
            leads,
            count: leads.length
        });
    } catch (error) {
        return next(new ErrorHandler('Error fetching popup email leads', 500));
    }
});

// Delete Popup Email Lead ---ADMIN
exports.deletePopupEmailLead = asyncErrorHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const lead = await PopupEmailLead.findByIdAndDelete(id);
        
        if (!lead) {
            return next(new ErrorHandler('Popup email lead not found', 404));
        }
        
        res.status(200).json({
            success: true,
            message: 'Popup email lead deleted successfully'
        });
    } catch (error) {
        return next(new ErrorHandler('Error deleting popup email lead', 500));
    }
});  