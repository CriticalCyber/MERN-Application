const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { ErrorHandler } = require('../utils/errorHandler');
const Delivery = require('../models/deliveryModel');
const Order = require('../models/orderModel');
const User = require('../models/OtpUser');

// Assign delivery agent to order
const assignDeliveryAgent = asyncErrorHandler(async (req, res, next) => {
    try {
        const { orderId, deliveryAgentId, deliveryDate, deliveryNotes } = req.body;
        
        // Validate required fields
        if (!orderId || !deliveryAgentId) {
            return next(new ErrorHandler('Order ID and Delivery Agent ID are required', 400));
        }

        // Check if order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return next(new ErrorHandler('Order not found', 404));
        }

        // Check if delivery agent exists and is a delivery agent
        const deliveryAgent = await User.findById(deliveryAgentId);
        if (!deliveryAgent) {
            return next(new ErrorHandler('Delivery agent not found', 404));
        }

        // Create or update delivery record
        let delivery = await Delivery.findOne({ orderId: orderId });
        
        if (delivery) {
            // Update existing delivery
            delivery.deliveryAgent = deliveryAgentId;
            delivery.deliveryAgentName = deliveryAgent.name;
            delivery.deliveryAgentPhone = deliveryAgent.phone || '';
            delivery.deliveryStatus = 'assigned';
            delivery.deliveryDate = deliveryDate || new Date();
            delivery.deliveryNotes = deliveryNotes || '';
            delivery.statusHistory.push({
                status: 'assigned',
                statusMessage: `Assigned to delivery agent: ${deliveryAgent.name}`,
                date: new Date()
            });
            
            await delivery.save();
        } else {
            // Create new delivery record
            const deliveryId = `LOCAL-${orderId.toString().slice(-6)}-${Date.now()}`;
            
            delivery = new Delivery({
                orderId: orderId,
                deliveryId: deliveryId,
                deliveryType: 'LOCAL',
                deliveryAgent: deliveryAgentId,
                deliveryAgentName: deliveryAgent.name,
                deliveryAgentPhone: deliveryAgent.phone || '',
                deliveryStatus: 'assigned',
                deliveryDate: deliveryDate || new Date(),
                deliveryNotes: deliveryNotes || '',
                statusHistory: [{
                    status: 'assigned',
                    statusMessage: `Assigned to delivery agent: ${deliveryAgent.name}`,
                    date: new Date()
                }]
            });
            
            await delivery.save();
        }

        // Update order status
        order.deliveryStatus = 'Assigned';
        order.deliveryAgent = deliveryAgentId;
        order.deliveryAgentName = deliveryAgent.name;
        order.deliveryAgentPhone = deliveryAgent.phone || '';
        order.trackingId = delivery.deliveryId;
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Delivery agent assigned successfully',
            delivery
        });
    } catch (error) {
        console.error('Error assigning delivery agent:', error);
        return next(new ErrorHandler(`Failed to assign delivery agent: ${error.message}`, 500));
    }
});

// Update delivery status
const updateDeliveryStatus = asyncErrorHandler(async (req, res, next) => {
    try {
        const { deliveryId, status, deliveryEta } = req.body;
        
        if (!deliveryId || !status) {
            return next(new ErrorHandler('Delivery ID and status are required', 400));
        }

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'packed', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'rto'];
        if (!validStatuses.includes(status)) {
            return next(new ErrorHandler(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`, 400));
        }

        const delivery = await Delivery.findOne({ deliveryId: deliveryId });
        if (!delivery) {
            return next(new ErrorHandler('Delivery not found', 404));
        }

        // Update delivery status
        const oldStatus = delivery.deliveryStatus;
        delivery.deliveryStatus = status;
        
        if (deliveryEta) {
            delivery.deliveryEta = deliveryEta;
        }
        
        if (status === 'delivered') {
            delivery.deliveredAt = new Date();
            delivery.statusHistory.push({
                status: 'delivered',
                statusMessage: 'Package delivered successfully',
                date: new Date()
            });
        } else if (status === 'out_for_delivery') {
            delivery.statusHistory.push({
                status: 'out_for_delivery',
                statusMessage: 'Package out for delivery',
                date: new Date()
            });
        } else if (status === 'cancelled') {
            delivery.statusHistory.push({
                status: 'cancelled',
                statusMessage: 'Delivery cancelled',
                date: new Date()
            });
        } else {
            delivery.statusHistory.push({
                status: status,
                statusMessage: `Status updated to ${status}`,
                date: new Date()
            });
        }

        await delivery.save();

        // Update related order status
        const order = await Order.findById(delivery.orderId);
        if (order) {
            // Map delivery status to order status
            const orderStatusMap = {
                'delivered': 'Delivered',
                'out_for_delivery': 'Out for Delivery',
                'cancelled': 'Cancelled',
                'rto': 'RTO',
                'assigned': 'Shipped',
                'packed': 'Shipped'
            };
            
            if (orderStatusMap[status]) {
                order.deliveryStatus = orderStatusMap[status];
                if (status === 'delivered') {
                    order.deliveredAt = new Date();
                }
                await order.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'Delivery status updated successfully',
            delivery
        });
    } catch (error) {
        console.error('Error updating delivery status:', error);
        return next(new ErrorHandler(`Failed to update delivery status: ${error.message}`, 500));
    }
});

// Get delivery by ID
const getDeliveryById = asyncErrorHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const delivery = await Delivery.findById(id)
            .populate('orderId', 'orderStatus totalPrice shippingInfo')
            .populate('deliveryAgent', 'name email phone');
            
        if (!delivery) {
            return next(new ErrorHandler('Delivery not found', 404));
        }

        res.status(200).json({
            success: true,
            delivery
        });
    } catch (error) {
        console.error('Error fetching delivery:', error);
        return next(new ErrorHandler(`Failed to fetch delivery: ${error.message}`, 500));
    }
});

// Get deliveries for admin
const getDeliveries = asyncErrorHandler(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const deliveryAgent = req.query.deliveryAgent;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        // Build filter object
        let filter = {};
        
        if (status) {
            filter.deliveryStatus = status;
        }
        
        if (deliveryAgent) {
            filter.deliveryAgent = deliveryAgent;
        }
        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                filter.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                filter.createdAt.$lte = new Date(dateTo);
            }
        }

        const deliveries = await Delivery.find(filter)
            .populate('orderId', 'orderStatus totalPrice shippingInfo')
            .populate('deliveryAgent', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Delivery.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: deliveries.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            deliveries
        });
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        return next(new ErrorHandler(`Failed to fetch deliveries: ${error.message}`, 500));
    }
});

// Get deliveries for a specific delivery agent
const getAgentDeliveries = asyncErrorHandler(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;

        // Build filter object for the agent's deliveries
        let filter = {
            deliveryAgent: req.user._id
        };
        
        if (status) {
            filter.deliveryStatus = status;
        }

        const deliveries = await Delivery.find(filter)
            .populate('orderId', 'orderStatus totalPrice shippingInfo')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Delivery.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: deliveries.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            deliveries
        });
    } catch (error) {
        console.error('Error fetching agent deliveries:', error);
        return next(new ErrorHandler(`Failed to fetch agent deliveries: ${error.message}`, 500));
    }
});

// Get delivery by delivery ID (for tracking)
const getDeliveryByTrackingId = asyncErrorHandler(async (req, res, next) => {
    try {
        const { trackingId } = req.params;
        
        const delivery = await Delivery.findOne({ deliveryId: trackingId })
            .populate('orderId', 'orderStatus deliveryStatus')
            .populate('deliveryAgent', 'name phone');
            
        if (!delivery) {
            return next(new ErrorHandler('Delivery not found', 404));
        }

        res.status(200).json({
            success: true,
            delivery
        });
    } catch (error) {
        console.error('Error fetching delivery by tracking ID:', error);
        return next(new ErrorHandler(`Failed to fetch delivery: ${error.message}`, 500));
    }
});

module.exports = {
    assignDeliveryAgent,
    updateDeliveryStatus,
    getDeliveryById,
    getDeliveries,
    getAgentDeliveries,
    getDeliveryByTrackingId
};