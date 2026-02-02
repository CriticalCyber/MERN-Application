const Coupon = require('../models/couponModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import socket event emitters
const { 
    emitCouponCreated, 
    emitCouponUpdated, 
    emitCouponDeleted,
    emitCouponActivated,
    emitCouponDeactivated
} = require('../utils/socketEvents');
// Import cache manager
const { invalidateCache } = require('../utils/cacheManager');

// Get All Coupons ---ADMIN
exports.getAllCoupons = asyncErrorHandler(async (req, res, next) => {
    const coupons = await Coupon.find().select('-__v').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        coupons,
    });
});

// Get Active Coupons ---PUBLIC
exports.getActiveCoupons = asyncErrorHandler(async (req, res, next) => {
    const coupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    }).select('-__v').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        coupons,
    });
});

// Get Coupon Details ---ADMIN
exports.getCoupon = asyncErrorHandler(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id).select('-__v').lean();

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    res.status(200).json({
        success: true,
        coupon,
    });
});

// Create Coupon ---ADMIN
exports.createCoupon = asyncErrorHandler(async (req, res, next) => {
    // Sanitize inputs
    req.body.code = sanitizeInput(req.body.code.toUpperCase());
    req.body.discountType = sanitizeInput(req.body.discountType);
    req.body.applicableCategories = req.body.applicableCategories ? 
        req.body.applicableCategories.map(category => sanitizeInput(category)) : [];

    const coupon = await Coupon.create(req.body);
    
    // Emit socket event for coupon creation
    const io = req.app.get('io');
    emitCouponCreated(io, coupon.toJSON());
    
    // Invalidate cache
    await invalidateCache('coupons');

    res.status(201).json({
        success: true,
        coupon
    });
});

// Update Coupon ---ADMIN
exports.updateCoupon = asyncErrorHandler(async (req, res, next) => {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    // Sanitize inputs
    if (req.body.code) req.body.code = sanitizeInput(req.body.code.toUpperCase());
    if (req.body.discountType) req.body.discountType = sanitizeInput(req.body.discountType);
    if (req.body.applicableCategories) {
        req.body.applicableCategories = req.body.applicableCategories.map(category => sanitizeInput(category));
    }

    coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });
    
    // Emit socket event for coupon update
    const io = req.app.get('io');
    emitCouponUpdated(io, coupon.toJSON());
    
    // Invalidate cache
    await invalidateCache('coupons');

    res.status(200).json({
        success: true,
        coupon
    });
});

// Delete Coupon ---ADMIN
exports.deleteCoupon = asyncErrorHandler(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    await coupon.remove();
    
    // Emit socket event for coupon deletion
    const io = req.app.get('io');
    emitCouponDeleted(io, req.params.id);
    
    // Invalidate cache
    await invalidateCache('coupons');

    res.status(200).json({
        success: true,
    });
});

// Apply Coupon
exports.applyCoupon = asyncErrorHandler(async (req, res, next) => {
    const { code, cartTotal } = req.body;

    // Sanitize input
    const sanitizedCode = sanitizeInput(code.toUpperCase());

    const coupon = await Coupon.findOne({
        code: sanitizedCode,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    });

    if (!coupon) {
        return next(new ErrorHandler("Invalid or expired coupon code", 400));
    }

    // Check if coupon has usage limit and if it's exceeded
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return next(new ErrorHandler("Coupon usage limit exceeded", 400));
    }

    // Check if cart total meets minimum amount requirement
    if (cartTotal < coupon.minimumAmount) {
        return next(new ErrorHandler(`Minimum cart amount of ₹${coupon.minimumAmount} required to use this coupon`, 400));
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
        discount = (cartTotal * coupon.discountValue) / 100;
        // Apply maximum discount limit if set
        if (coupon.maximumDiscount > 0) {
            discount = Math.min(discount, coupon.maximumDiscount);
        }
    } else {
        discount = Math.min(coupon.discountValue, cartTotal); // Fixed discount
    }

    const finalAmount = cartTotal - discount;

    res.status(200).json({
        success: true,
        discount,
        finalAmount,
        coupon
    });
});

// Get Active Coupons for Popup ---PUBLIC
exports.getActiveCouponsForPopup = asyncErrorHandler(async (req, res, next) => {
    const coupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
    }).select('-__v').sort({ createdAt: -1 }).lean();

    res.status(200).json({
        success: true,
        coupons,
    });
});