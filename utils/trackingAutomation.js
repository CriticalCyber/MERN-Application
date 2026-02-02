const Order = require('../models/orderModel');
const Shipment = require('../models/shipmentModel');
// SMS utility removed - using MSG91 service directly
const { ErrorHandler } = require('./errorHandler');

class TrackingAutomation {
    constructor() {
        this.baseUrl = process.env.BASE_URL || 'https://shubhvaluecart.com';
    }

    // Generate tracking URL for a shipment
    generateTrackingUrl(awb) {
        if (!awb) {
            throw new Error('AWB is required to generate tracking URL');
        }
        return `${this.baseUrl}/track/${awb}`;
    }

    // Send tracking notification to customer
    async sendTrackingNotification(orderId, eventType = 'shipment_created') {
        try {
            // Get order and shipment details
            const order = await Order.findById(orderId).populate('user', 'name email phone');
            if (!order) {
                throw new ErrorHandler('Order not found', 404);
            }

            const shipment = await Shipment.findOne({ orderId: order._id });
            if (!shipment || !shipment.awb) {
                console.log('No shipment or AWB found for order:', order._id);
                return false;
            }

            // Generate tracking URL
            const trackingUrl = this.generateTrackingUrl(shipment.awb);

            // Prepare notification content based on event type
            let subject, message;
            switch (eventType) {
                case 'shipment_created':
                    subject = 'Your Order Has Been Shipped!';
                    message = `Hi ${order.user?.name || 'Customer'},

Your order has been shipped and is on its way! Track your shipment using the link below:

Tracking URL: ${trackingUrl}

Thank you for shopping with us!`;
                    break;
                case 'out_for_delivery':
                    subject = 'Your Order is Out for Delivery!';
                    message = `Hi ${order.user?.name || 'Customer'},

Your order is out for delivery! Track your shipment using the link below:

Tracking URL: ${trackingUrl}

Expect delivery today!`;
                    break;
                case 'delivered':
                    subject = 'Your Order Has Been Delivered!';
                    message = `Hi ${order.user?.name || 'Customer'},

Your order has been successfully delivered! Track your shipment using the link below:

Tracking URL: ${trackingUrl}

Thank you for shopping with us!`;
                    break;
                case 'cod_settlement':
                    subject = 'COD Payment Received';
                    message = `Hi ${order.user?.name || 'Customer'},

Your COD payment for the order has been successfully received and settled! Track your shipment using the link below:

Tracking URL: ${trackingUrl}

Thank you for shopping with us!`;
                    break;
                default:
                    subject = 'Order Update';
                    message = `Hi ${order.user?.name || 'Customer'},

Your order has been updated. Track your shipment using the link below:

Tracking URL: ${trackingUrl}

Thank you for shopping with us!`;
            }

            // Skip email notification to prevent undefined.to errors
            // Email notifications have been deprecated for customer communications
            // Only SMS notifications via MSG91 are used for customers

            // Send SMS notification
            if (order.user?.phone) {
                // TODO: Implement SMS notification using MSG91 service
                // This will require implementing a new SMS notification service
                console.log('SMS notification would be sent to:', order.user.phone);
                console.log('Message:', message);
            }

            // TODO: Add WhatsApp notification if available
            // This would require a WhatsApp Business API integration

            return true;
        } catch (error) {
            console.error('Error sending tracking notification:', error);
            throw error;
        }
    }

    // Auto-trigger notifications based on shipment status
    async triggerNotificationsForStatusChange(shipment, newStatus) {
        try {
            const notificationTriggers = {
                'shipped': 'shipment_created',
                'out_for_delivery': 'out_for_delivery',
                'delivered': 'delivered',
                'cod_settlement': 'cod_settlement'
            };

            const eventType = notificationTriggers[newStatus];
            if (eventType) {
                await this.sendTrackingNotification(shipment.orderId, eventType);
            }
        } catch (error) {
            console.error('Error triggering notification for status change:', error);
            // Don't throw error as this shouldn't break the main flow
        }
    }
}

module.exports = new TrackingAutomation();