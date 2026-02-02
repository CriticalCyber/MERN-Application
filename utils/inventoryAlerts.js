const cron = require('node-cron');
const Inventory = require('../models/inventoryModel');
const Product = require('../models/productModel');


/**
 * Check for low stock items and send alerts
 * @param {Object} io - Socket.IO instance
 */
const checkLowStockItems = async (io) => {
    try {
        // Find all inventory items that are low on stock
        const lowStockItems = await Inventory.find({
            quantityAvailable: { $gt: 0, $lte: '$reorderLevel' }
        }).populate('product', 'name sku');

        // Log low stock items (alerts removed)
        for (const item of lowStockItems) {
            if (item.product) {
                console.log(`Low stock alert for product "${item.product.name}" (SKU: ${item.sku}): ${item.quantityAvailable} remaining, reorder level: ${item.reorderLevel}`);
            }
        }

        console.log(`Checked ${lowStockItems.length} low stock items`);
    } catch (error) {
        console.error('Error checking low stock items:', error);
    }
};

/**
 * Check for out of stock items
 * @param {Object} io - Socket.IO instance
 */
const checkOutOfStockItems = async (io) => {
    try {
        // Find all inventory items that are out of stock
        const outOfStockItems = await Inventory.find({
            quantityAvailable: 0
        }).populate('product', 'name sku');

        // Log out of stock items (alerts removed)
        for (const item of outOfStockItems) {
            if (item.product) {
                console.log(`Out of stock alert for product "${item.product.name}" (SKU: ${item.sku}): ${item.quantityAvailable} remaining`);
            }
        }

        console.log(`Checked ${outOfStockItems.length} out of stock items`);
    } catch (error) {
        console.error('Error checking out of stock items:', error);
    }
};

/**
 * Schedule inventory alerts
 * @param {Object} io - Socket.IO instance
 */
const scheduleInventoryAlerts = (io) => {
    // Run low stock check every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running hourly low stock check...');
        await checkLowStockItems(io);
    });

    // Run out of stock check every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('Running 30-minute out of stock check...');
        await checkOutOfStockItems(io);
    });

    console.log('Inventory alert schedules initialized');
};

module.exports = {
    checkLowStockItems,
    checkOutOfStockItems,
    scheduleInventoryAlerts
};