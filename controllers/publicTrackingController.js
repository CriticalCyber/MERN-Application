const Order = require('../models/orderModel');
const Delivery = require('../models/deliveryModel'); // Updated model name
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { ErrorHandler } = require('../utils/errorHandler');

// Public tracking by AWB
const trackByAWB = asyncErrorHandler(async (req, res, next) => {
    const { awb } = req.params;

    // Validate AWB/Tracking ID format
    if (!awb || awb.trim().length === 0) {
        return next(new ErrorHandler('Tracking ID is required', 400));
    }

    try {
        // Get delivery details by tracking ID (which can be AWB or local delivery ID)
        let delivery = await Delivery.findOne({ trackingId: awb.trim() })
            .populate('orderId', 'orderStatus deliveryStatus');
        
        // If not found in delivery model, try to find in order model
        if (!delivery) {
            const order = await Order.findOne({ trackingId: awb.trim() });
            if (order) {
                // Create response based on order information
                const response = {
                    trackingId: order.trackingId,
                    deliveryCompany: order.deliveryType === 'LOCAL' ? 'Local Delivery' : 'Unknown',
                    currentStatus: order.deliveryStatus,
                    deliveryStatus: order.deliveryStatus,
                    shippedAt: order.shippedAt,
                    deliveredAt: order.deliveredAt,
                    statusHistory: [], // Default empty array
                    estimatedDeliveryDate: order.estimatedDeliveryDate
                };
                
                res.status(200).json({
                    success: true,
                    tracking: response
                });
                return;
            }
        }

        if (!delivery) {
            return next(new ErrorHandler('Delivery not found for the provided tracking ID', 404));
        }

        // Prepare response with essential tracking information
        const response = {
            trackingId: delivery.trackingId || delivery.deliveryId,
            deliveryCompany: delivery.deliveryCompany,
            currentStatus: delivery.deliveryStatus,
            deliveryStatus: delivery.deliveryStatus === 'delivered' ? 'Delivered' : 
                           delivery.deliveryStatus === 'shipped' ? 'Shipped' : 
                           delivery.deliveryStatus === 'in_transit' ? 'In Transit' : 
                           delivery.deliveryStatus === 'out_for_delivery' ? 'Out for Delivery' : 
                           delivery.deliveryStatus === 'cancelled' ? 'Cancelled' : 
                           delivery.deliveryStatus === 'rto' ? 'RTO' : 'Processing',
            shippedAt: delivery.shippedAt,
            deliveredAt: delivery.deliveredAt,
            statusHistory: delivery.statusHistory,
            estimatedDeliveryDate: delivery.estimatedDeliveryDate,
            deliveryAgentName: delivery.deliveryAgentName,
            deliveryAgentPhone: delivery.deliveryAgentPhone,
            deliveryEta: delivery.deliveryEta
        };

        res.status(200).json({
            success: true,
            tracking: response
        });
    } catch (error) {
        console.error('Error in public tracking by AWB:', error);
        return next(new ErrorHandler(`Failed to track delivery: ${error.message}`, 500));
    }
});

// Public tracking by Order Number
const trackByOrder = asyncErrorHandler(async (req, res, next) => {
    const { orderNumber } = req.params;

    // Validate order number format
    if (!orderNumber || orderNumber.trim().length === 0) {
        return next(new ErrorHandler('Order number is required', 400));
    }

    try {
        // Find order by ID (assuming orderNumber is the MongoDB ObjectId)
        let order;
        try {
            order = await Order.findById(orderNumber);
        } catch (err) {
            // If it's not a valid ObjectId, try to find by other order identifiers
            // For now, we'll assume it's an ObjectId, but in a real implementation you might need more complex logic
            return next(new ErrorHandler('Invalid order number format', 400));
        }

        if (!order) {
            return next(new ErrorHandler('Order not found', 404));
        }

        // Get delivery details by order
        const delivery = await Delivery.findOne({ orderId: order._id })
            .populate('orderId', 'orderStatus deliveryStatus');

        if (!delivery) {
            // If no delivery record exists, return order information
            const response = {
                orderNumber: order._id.toString(),
                trackingId: order.trackingId,
                deliveryCompany: order.deliveryType === 'LOCAL' ? 'Local Delivery' : 'Unknown',
                currentStatus: order.deliveryStatus,
                deliveryStatus: order.deliveryStatus,
                shippedAt: order.shippedAt,
                deliveredAt: order.deliveredAt,
                statusHistory: [], // Default empty array
                estimatedDeliveryDate: order.estimatedDeliveryDate
            };
            
            res.status(200).json({
                success: true,
                tracking: response
            });
            return;
        }

        // Prepare response with essential tracking information
        const response = {
            orderNumber: order._id.toString(),
            trackingId: delivery.trackingId || delivery.deliveryId,
            deliveryCompany: delivery.deliveryCompany,
            currentStatus: delivery.deliveryStatus,
            deliveryStatus: delivery.deliveryStatus === 'delivered' ? 'Delivered' : 
                           delivery.deliveryStatus === 'shipped' ? 'Shipped' : 
                           delivery.deliveryStatus === 'in_transit' ? 'In Transit' : 
                           delivery.deliveryStatus === 'out_for_delivery' ? 'Out for Delivery' : 
                           delivery.deliveryStatus === 'cancelled' ? 'Cancelled' : 
                           delivery.deliveryStatus === 'rto' ? 'RTO' : 'Processing',
            shippedAt: delivery.shippedAt,
            deliveredAt: delivery.deliveredAt,
            statusHistory: delivery.statusHistory,
            estimatedDeliveryDate: delivery.estimatedDeliveryDate,
            deliveryAgentName: delivery.deliveryAgentName,
            deliveryAgentPhone: delivery.deliveryAgentPhone,
            deliveryEta: delivery.deliveryEta
        };

        res.status(200).json({
            success: true,
            tracking: response
        });
    } catch (error) {
        console.error('Error in public tracking by order:', error);
        return next(new ErrorHandler(`Failed to track order: ${error.message}`, 500));
    }
});

module.exports = {
    trackByAWB,
    trackByOrder
};