const Inventory = require('../models/inventoryModel');
const InventoryTransaction = require('../models/inventoryTransactionModel');
const Product = require('../models/productModel');
const ErrorHandler = require('../utils/errorHandler');

// Simple in-memory locking mechanism for user-level stock reservation
const userLocks = new Map(); // Maps userId -> Set of locked productIds
const lockTimeouts = new Map(); // Maps lockKey -> timeoutId

// Clean up expired locks periodically
setInterval(() => {
    const now = Date.now();
    for (const [lockKey, timeoutId] of lockTimeouts.entries()) {
        // Locks expire after 30 seconds
        if (now - timeoutId > 30000) {
            const [userId, productId] = lockKey.split(':');
            if (userLocks.has(userId)) {
                const userLocksSet = userLocks.get(userId);
                userLocksSet.delete(productId);
                if (userLocksSet.size === 0) {
                    userLocks.delete(userId);
                }
            }
            lockTimeouts.delete(lockKey);
        }
    }
}, 10000); // Check every 10 seconds

/**
 * Add stock to inventory (IN transaction)
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to add
 * @param {String} reference - Reference (e.g., purchase order ID, manual entry)
 * @param {String} performedBy - User ID who performed the action
 * @param {String} notes - Optional notes
 * @returns {Object} Updated inventory record
 */
exports.addStock = async (productId, quantity, reference, performedBy, notes = '') => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find or create inventory record
        let inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            // Get product to get SKU
            const product = await Product.findById(productId).session(session);
            if (!product) {
                throw new ErrorHandler('Product not found', 404);
            }
            
            // Create new inventory record
            inventory = new Inventory({
                product: productId,
                sku: product.sku,
                quantityAvailable: 0,
                quantityReserved: 0
            });
        }

        // Update available quantity
        inventory.quantityAvailable += quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Create transaction record
        const transaction = new InventoryTransaction({
            product: productId,
            type: 'IN',
            quantity: quantity,
            reference: reference,
            performedBy: performedBy === 'system' ? null : performedBy,
            notes: notes
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Remove stock from inventory (OUT transaction)
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to remove
 * @param {String} reference - Reference (e.g., order ID, manual entry)
 * @param {String} performedBy - User ID who performed the action
 * @param {String} notes - Optional notes
 * @returns {Object} Updated inventory record
 */
exports.removeStock = async (productId, quantity, reference, performedBy, notes = '') => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find inventory record
        const inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            throw new ErrorHandler('Inventory record not found for this product', 404);
        }

        // Check if enough stock is available
        if (inventory.quantityAvailable < quantity) {
            throw new ErrorHandler(`Insufficient stock. Available: ${inventory.quantityAvailable}, Requested: ${quantity}`, 400);
        }

        // Update available quantity
        inventory.quantityAvailable -= quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Create transaction record
        const transaction = new InventoryTransaction({
            product: productId,
            type: 'OUT',
            quantity: quantity,
            reference: reference,
            performedBy: performedBy === 'system' ? null : performedBy,
            notes: notes
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Adjust stock manually (ADJUSTMENT transaction)
 * @param {String} productId - Product ID
 * @param {Number} quantity - New quantity (can be positive or negative)
 * @param {String} reference - Reference (e.g., manual adjustment)
 * @param {String} performedBy - User ID who performed the action
 * @param {String} notes - Optional notes
 * @returns {Object} Updated inventory record
 */
exports.adjustStock = async (productId, quantity, reference, performedBy, notes = '') => {
    // Validate inputs
    if (!productId || !quantity) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find or create inventory record
        let inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            // Get product to get SKU
            const product = await Product.findById(productId).session(session);
            if (!product) {
                throw new ErrorHandler('Product not found', 404);
            }
            
            // Create new inventory record
            inventory = new Inventory({
                product: productId,
                sku: product.sku,
                quantityAvailable: 0,
                quantityReserved: 0
            });
        }

        // Calculate the actual adjustment quantity
        const adjustmentQuantity = quantity - inventory.quantityAvailable;

        // Update available quantity
        inventory.quantityAvailable = quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Create transaction record
        const transaction = new InventoryTransaction({
            product: productId,
            type: 'ADJUSTMENT',
            quantity: Math.abs(adjustmentQuantity),
            reference: reference,
            performedBy: performedBy === 'system' ? null : performedBy,
            notes: notes
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Update product active status based on new inventory levels
        await exports.updateProductActiveStatus(productId);

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Reserve stock for an order
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to reserve
 * @param {String} reference - Reference (e.g., order ID)
 * @returns {Object} Updated inventory record
 */
exports.reserveStock = async (productId, quantity, reference, userId = null) => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // User-level locking to prevent race conditions
    const lockKey = `${userId || 'anonymous'}:${productId}`;
    
    if (userId) {
        // Check if user already has this product locked
        if (userLocks.has(userId) && userLocks.get(userId).has(productId)) {
            throw new ErrorHandler('Product already locked for this user', 409);
        }
        
        // Acquire lock
        if (!userLocks.has(userId)) {
            userLocks.set(userId, new Set());
        }
        userLocks.get(userId).add(productId);
        
        // Set timeout for lock cleanup
        lockTimeouts.set(lockKey, Date.now());
    }

    // Atomic operation: find and update inventory in single DB call
    // This prevents race conditions and overselling
    // Using findOneAndUpdate with $gte condition ensures atomicity
    const inventory = await Inventory.findOneAndUpdate(
        {
            product: productId,
            quantityAvailable: { $gte: quantity }
        },
        {
            $inc: {
                quantityAvailable: -quantity,
                quantityReserved: +quantity
            },
            $set: { lastUpdated: Date.now() }
        },
        {
            new: true
        }
    );

    if (!inventory) {
        // Release lock on failure
        if (userId && userLocks.has(userId)) {
            const userLocksSet = userLocks.get(userId);
            userLocksSet.delete(productId);
            if (userLocksSet.size === 0) {
                userLocks.delete(userId);
            }
            lockTimeouts.delete(lockKey);
        }
        throw new ErrorHandler('Insufficient stock or inventory not found', 400);
    }

    // Clean up lock on success
    if (userId && userLocks.has(userId)) {
        const userLocksSet = userLocks.get(userId);
        userLocksSet.delete(productId);
        if (userLocksSet.size === 0) {
            userLocks.delete(userId);
        }
        lockTimeouts.delete(lockKey);
    }

    // Create transaction record separately (outside atomic operation)
    const transaction = new InventoryTransaction({
        product: productId,
        type: 'OUT',
        quantity: quantity,
        reference: reference,
        notes: 'Stock reserved for order'
    });
    await transaction.save();
    
    // Update product active status based on new inventory levels
    await exports.updateProductActiveStatus(productId);

    return inventory;
};

/**
 * Release reserved stock (when order is cancelled)
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to release
 * @param {String} reference - Reference (e.g., order ID)
 * @returns {Object} Updated inventory record
 */
exports.releaseReservedStock = async (productId, quantity, reference) => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find inventory record
        const inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            throw new ErrorHandler('Inventory record not found for this product', 404);
        }

        // Check if enough stock is reserved
        if (inventory.quantityReserved < quantity) {
            throw new ErrorHandler(`Insufficient reserved stock. Reserved: ${inventory.quantityReserved}, Requested: ${quantity}`, 400);
        }

        // Update quantities
        inventory.quantityAvailable += quantity;
        inventory.quantityReserved -= quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Create transaction record
        const transaction = new InventoryTransaction({
            product: productId,
            type: 'IN',
            quantity: quantity,
            reference: reference,
            notes: 'Reserved stock released'
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Update product active status based on new inventory levels
        await exports.updateProductActiveStatus(productId);

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Fulfill reserved stock (when order is delivered)
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to fulfill
 * @param {String} reference - Reference (e.g., order ID)
 * @returns {Object} Updated inventory record
 */
exports.fulfillReservedStock = async (productId, quantity, reference) => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find inventory record
        const inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            throw new ErrorHandler('Inventory record not found for this product', 404);
        }

        // Check if enough stock is reserved
        if (inventory.quantityReserved < quantity) {
            throw new ErrorHandler(`Insufficient reserved stock. Reserved: ${inventory.quantityReserved}, Requested: ${quantity}`, 400);
        }

        // Update reserved quantity
        inventory.quantityReserved -= quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Note: No transaction record needed here as it was already created when reserving

        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Update product active status based on new inventory levels
        await exports.updateProductActiveStatus(productId);

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Finalize reserved stock after successful payment (payment success)
 * This is the same as fulfillReservedStock but with more explicit naming for payment context
 * @param {String} productId - Product ID
 * @param {Number} quantity - Quantity to finalize
 * @param {String} reference - Reference (e.g., order ID)
 * @returns {Object} Updated inventory record
 */
exports.finalizeStock = async (productId, quantity, reference) => {
    // Validate inputs
    if (!productId || !quantity || quantity <= 0) {
        throw new ErrorHandler('Invalid product ID or quantity', 400);
    }

    if (!reference) {
        throw new ErrorHandler('Reference is required', 400);
    }

    // Start a session for transaction
    const session = await Inventory.startSession();
    session.startTransaction();

    try {
        // Find inventory record
        const inventory = await Inventory.findOne({ product: productId }).session(session);
        
        if (!inventory) {
            throw new ErrorHandler('Inventory record not found for this product', 404);
        }

        // Check if enough stock is reserved
        if (inventory.quantityReserved < quantity) {
            throw new ErrorHandler(`Insufficient reserved stock. Reserved: ${inventory.quantityReserved}, Requested: ${quantity}`, 400);
        }

        // Update reserved quantity (convert from reserved to sold)
        inventory.quantityReserved -= quantity;
        inventory.lastUpdated = Date.now();
        await inventory.save({ session });

        // Create transaction record for payment finalization
        const transaction = new InventoryTransaction({
            product: productId,
            type: 'OUT',
            quantity: quantity,
            reference: reference,
            notes: 'Stock finalized after successful payment'
        });
        await transaction.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Update product active status based on new inventory levels
        await exports.updateProductActiveStatus(productId);

        return inventory;
    } catch (error) {
        // Abort transaction
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Get inventory summary for a product
 * @param {String} productId - Product ID
 * @returns {Object} Inventory summary
 */
exports.getInventorySummary = async (productId) => {
    const inventory = await Inventory.findOne({ product: productId }).populate('product', 'name sku');
    if (!inventory) {
        throw new ErrorHandler('Inventory record not found for this product', 404);
    }
    return inventory;
};

/**
 * Get low stock items
 * @param {Number} threshold - Low stock threshold
 * @returns {Array} List of low stock items
 */
exports.getLowStockItems = async (threshold = 10) => {
    return await Inventory.find({ 
        quantityAvailable: { $gt: 0, $lte: threshold } 
    }).populate('product', 'name sku price');
};

/**
 * Get out of stock items
 * @returns {Array} List of out of stock items
 */
exports.getOutOfStockItems = async () => {
    return await Inventory.find({ 
        quantityAvailable: 0 
    }).populate('product', 'name sku price');
};

/**
 * Update product is_active status based on inventory levels
 * @param {String} productId - Product ID
 * @returns {Object} Updated product
 */
exports.updateProductActiveStatus = async (productId) => {
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
        // If no inventory record exists, we can't determine status
        return null;
    }
    
    const Product = require('../models/productModel');
    
    // Get the product
    const product = await Product.findById(productId);
    if (!product) {
        throw new ErrorHandler('Product not found', 404);
    }
    
    // Determine if product should be active based on available stock
    const shouldBeActive = inventory.quantityAvailable > 0;
    
    // Only update if status has changed
    if (product.is_active !== shouldBeActive) {
        product.is_active = shouldBeActive;
        await product.save();
        
        // Log the change
        console.log(`Product ${product.name} (${productId}) is_active status updated to ${shouldBeActive}`);
    }
    
    return product;
};

/**
 * Update multiple products active status based on their inventory levels
 * @param {Array} productIds - Array of Product IDs
 * @returns {Array} Updated products
 */
exports.updateMultipleProductsActiveStatus = async (productIds) => {
    const updatedProducts = [];
    
    for (const productId of productIds) {
        try {
            const updatedProduct = await exports.updateProductActiveStatus(productId);
            if (updatedProduct) {
                updatedProducts.push(updatedProduct);
            }
        } catch (error) {
            console.error(`Error updating product ${productId} active status:`, error.message);
        }
    }
    
    return updatedProducts;
};