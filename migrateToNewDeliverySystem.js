const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Order = require('./models/orderModel');
const Delivery = require('./models/deliveryModel');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const migrateOrdersToNewDeliverySystem = async () => {
    try {
        console.log('Starting migration to new local delivery system...');

        // Get all orders that have Shiprocket-related data
        const orders = await Order.find({
            $or: [
                { deliveryPartner: { $exists: true } },
                { shipmentId: { $exists: true, $ne: null } },
                { awb: { $exists: true, $ne: null } },
                { trackingUrl: { $exists: true, $ne: null } },
                { courierName: { $exists: true, $ne: null } }
            ]
        });

        console.log(`Found ${orders.length} orders with Shiprocket data to migrate`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const order of orders) {
            try {
                // Check if a delivery record already exists for this order
                const existingDelivery = await Delivery.findOne({ orderId: order._id });
                
                if (existingDelivery) {
                    console.log(`Skipping order ${order._id} - delivery record already exists`);
                    skippedCount++;
                    continue;
                }

                // Determine delivery type based on existing data
                const deliveryType = order.deliveryPartner || 'SHIPROCKET';
                
                // Create delivery record based on existing order data
                const delivery = new Delivery({
                    orderId: order._id,
                    deliveryId: order.trackingId || order.awb || `MIGRATED-${order._id.toString().slice(-6)}-${Date.now()}`,
                    deliveryType: deliveryType === 'Shiprocket' ? 'COURIER' : deliveryType,
                    deliveryStatus: mapDeliveryStatus(order.deliveryStatus),
                    trackingId: order.trackingId || order.awb || null,
                    deliveryCompany: order.courierName || 'Unknown',
                    totalWeight: order.orderItems.reduce((total, item) => total + (item.weight || 100), 0),
                    declaredValue: order.totalPrice,
                    paymentMethod: order.paymentInfo?.status === 'paid' ? 'Prepaid' : 'COD',
                    codAmount: order.paymentInfo?.status !== 'paid' ? order.totalPrice : 0,
                    shippedAt: order.shippedAt,
                    deliveredAt: order.deliveredAt,
                    statusHistory: order.deliveryStatus ? [{
                        status: mapDeliveryStatus(order.deliveryStatus),
                        statusMessage: `Migrated from old system: ${order.deliveryStatus}`,
                        date: new Date()
                    }] : []
                });

                await delivery.save();

                // Update the order with new local delivery fields
                order.deliveryType = deliveryType === 'Shiprocket' ? 'SHIPROCKET' : 'LOCAL'; // Keep SHIPROCKET for backward compatibility
                order.trackingId = delivery.deliveryId;
                order.deliveryStatus = mapDeliveryStatus(order.deliveryStatus);
                
                // Clear old Shiprocket-specific fields if we want to completely remove them
                // For safety, we'll keep them but mark them as legacy
                order.legacyShipmentId = order.shipmentId;
                order.legacyAwb = order.awb;
                order.legacyTrackingUrl = order.trackingUrl;
                order.legacyCourierName = order.courierName;
                
                // Clear the old fields
                order.shipmentId = undefined;
                order.awb = undefined;
                order.trackingUrl = undefined;
                order.courierName = undefined;
                
                await order.save();
                
                console.log(`Migrated order ${order._id} to new delivery system`);
                migratedCount++;
            } catch (error) {
                console.error(`Error migrating order ${order._id}:`, error.message);
            }
        }

        console.log(`Migration completed!`);
        console.log(`- Migrated: ${migratedCount} orders`);
        console.log(`- Skipped: ${skippedCount} orders`);
        console.log(`- Total processed: ${orders.length} orders`);
        
        return { migratedCount, skippedCount, total: orders.length };
    } catch (error) {
        console.error('Error during migration:', error);
        throw error;
    }
};

// Helper function to map old delivery statuses to new ones
const mapDeliveryStatus = (oldStatus) => {
    const statusMap = {
        'Pending': 'pending',
        'Packed': 'packed',
        'Shipped': 'assigned',
        'In Transit': 'out_for_delivery',
        'Out for Delivery': 'out_for_delivery',
        'Delivered': 'delivered',
        'Cancelled': 'cancelled',
        'RTO': 'rto'
    };
    
    return statusMap[oldStatus] || 'pending';
};

const runMigration = async () => {
    try {
        await connectDB();
        const result = await migrateOrdersToNewDeliverySystem();
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = {
    migrateOrdersToNewDeliverySystem,
    mapDeliveryStatus
};