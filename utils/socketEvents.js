// Utility functions for emitting events (no-op since Socket.IO has been removed)

/**
 * Emit a product created event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} product - Created product data
 */
const emitProductCreated = (io, product) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a product updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} product - Updated product data
 */
const emitProductUpdated = (io, product) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a product deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} productId - ID of deleted product
 */
const emitProductDeleted = (io, productId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a stock updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} product - Product with updated stock
 */
const emitStockUpdated = (io, product) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a category created event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} category - Created category data
 */
const emitCategoryCreated = (io, category) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a category updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} category - Updated category data
 */
const emitCategoryUpdated = (io, category) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a category deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} categoryId - ID of deleted category
 */
const emitCategoryDeleted = (io, categoryId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit an order created event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} order - Created order data
 */
const emitOrderCreated = (io, order) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit an order updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} order - Updated order data
 */
const emitOrderUpdated = (io, order) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit an order deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} orderId - ID of deleted order
 * @param {String} userId - ID of user who placed the order
 */
const emitOrderDeleted = (io, orderId, userId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a user updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} user - Updated user data
 */
const emitUserUpdated = (io, user) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a user deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} userId - ID of deleted user
 */
const emitUserDeleted = (io, userId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a review created event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} review - Created review data
 * @param {String} productId - ID of product reviewed
 */
const emitReviewCreated = (io, review, productId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a review deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} reviewId - ID of deleted review
 * @param {String} productId - ID of product
 */
const emitReviewDeleted = (io, reviewId, productId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a coupon created event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} coupon - Created coupon data
 */
const emitCouponCreated = (io, coupon) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a coupon updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} coupon - Updated coupon data
 */
const emitCouponUpdated = (io, coupon) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a coupon deleted event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {String} couponId - ID of deleted coupon
 */
const emitCouponDeleted = (io, couponId) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a coupon activated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} coupon - Activated coupon data
 */
const emitCouponActivated = (io, coupon) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a coupon deactivated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} coupon - Deactivated coupon data
 */
const emitCouponDeactivated = (io, coupon) => {
    // No-op since Socket.IO has been removed
    return;
};

/**
 * Emit a settings updated event
 * @param {Object} io - Socket.IO instance (not used)
 * @param {Object} settings - Updated settings data
 */
const emitSettingsUpdated = (io, settings) => {
    // No-op since Socket.IO has been removed
    return;
};

module.exports = {
    emitProductCreated,
    emitProductUpdated,
    emitProductDeleted,
    emitStockUpdated,
    emitCategoryCreated,
    emitCategoryUpdated,
    emitCategoryDeleted,
    emitOrderCreated,
    emitOrderUpdated,
    emitOrderDeleted,
    emitUserUpdated,
    emitUserDeleted,
    emitReviewCreated,
    emitReviewDeleted,
    emitCouponCreated,
    emitCouponUpdated,
    emitCouponDeleted,
    emitCouponActivated,
    emitCouponDeactivated,
    emitSettingsUpdated
};