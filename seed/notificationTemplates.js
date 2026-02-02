const NotificationTemplate = require('../models/notificationTemplateModel');

const notificationTemplates = [
    {
        name: 'order_confirmation',
        subject: 'Order Confirmation - {{orderId}}',
        message: 'Hello {{customerName}},\n\nThank you for your order #{{orderId}} placed on {{orderDate}}.\n\nOrder Total: ₹{{orderTotal}}\nItems: {{itemCount}}\n\nWe\'ll notify you when your order is shipped.\n\nBest regards,\nShubhValueCart Team',
        type: 'email',
        channel: 'order',
        isActive: true,
        variables: [
            { name: 'customerName', description: 'Customer full name' },
            { name: 'orderId', description: 'Order ID' },
            { name: 'orderDate', description: 'Order date' },
            { name: 'orderTotal', description: 'Order total amount' },
            { name: 'itemCount', description: 'Number of items in order' }
        ]
    },
    {
        name: 'order_shipped',
        subject: 'Your Order #{{orderId}} Has Been Shipped',
        message: 'Hello {{customerName}},\n\nGreat news! Your order #{{orderId}} has been shipped.\n\nTracking Number: {{trackingNumber}}\nEstimated Delivery: {{estimatedDelivery}}\n\nYou can track your order status in your account.\n\nBest regards,\nShubhValueCart Team',
        type: 'email',
        channel: 'order',
        isActive: true,
        variables: [
            { name: 'customerName', description: 'Customer full name' },
            { name: 'orderId', description: 'Order ID' },
            { name: 'trackingNumber', description: 'Shipment tracking number' },
            { name: 'estimatedDelivery', description: 'Estimated delivery date' }
        ]
    },
    {
        name: 'order_delivered',
        subject: 'Order #{{orderId}} Delivered Successfully',
        message: 'Hello {{customerName}},\n\nYour order #{{orderId}} was delivered on {{deliveryDate}}.\n\nWe hope you love your purchase! If you have any questions or need assistance, please contact our customer support.\n\nThank you for shopping with ShubhValueCart!\n\nBest regards,\nShubhValueCart Team',
        type: 'email',
        channel: 'order',
        isActive: true,
        variables: [
            { name: 'customerName', description: 'Customer full name' },
            { name: 'orderId', description: 'Order ID' },
            { name: 'deliveryDate', description: 'Delivery date' }
        ]
    },
    {
        name: 'password_reset',
        subject: 'Password Reset Request',
        message: 'Hello {{customerName}},\n\nYou have requested to reset your password. Click the link below to reset your password:\n\n{{resetLink}}\n\nThis link will expire in 15 minutes. If you didn\'t request this, please ignore this email.\n\nBest regards,\nShubhValueCart Team',
        type: 'email',
        channel: 'system',
        isActive: true,
        variables: [
            { name: 'customerName', description: 'Customer full name' },
            { name: 'resetLink', description: 'Password reset link' }
        ]
    },
    {
        name: 'welcome_user',
        subject: 'Welcome to ShubhValueCart!',
        message: 'Hello {{customerName}},\n\nWelcome to ShubhValueCart! We\'re excited to have you as part of our community.\n\nStart exploring our wide range of products and enjoy fast delivery right to your doorstep.\n\nHappy shopping!\n\nBest regards,\nShubhValueCart Team',
        type: 'email',
        channel: 'system',
        isActive: true,
        variables: [
            { name: 'customerName', description: 'Customer full name' }
        ]
    },
    {
        name: 'order_confirmation_sms',
        subject: 'Order Confirmation',
        message: 'Thank you for your order #{{orderId}}. Total: ₹{{orderTotal}}. Track your order at shubhvaluecart.in/orders',
        type: 'sms',
        channel: 'order',
        isActive: true,
        variables: [
            { name: 'orderId', description: 'Order ID' },
            { name: 'orderTotal', description: 'Order total amount' }
        ]
    },
    {
        name: 'order_shipped_sms',
        subject: 'Order Shipped',
        message: 'Your order #{{orderId}} has been shipped. Tracking: {{trackingNumber}}. Estimated delivery: {{estimatedDelivery}}',
        type: 'sms',
        channel: 'order',
        isActive: true,
        variables: [
            { name: 'orderId', description: 'Order ID' },
            { name: 'trackingNumber', description: 'Shipment tracking number' },
            { name: 'estimatedDelivery', description: 'Estimated delivery date' }
        ]
    }
];

const seedNotificationTemplates = async () => {
    try {
        // Clear existing templates
        await NotificationTemplate.deleteMany({});
        
        // Insert new templates
        await NotificationTemplate.insertMany(notificationTemplates);
        
        console.log('Notification templates seeded successfully');
    } catch (error) {
        console.error('Error seeding notification templates:', error);
    }
};

module.exports = seedNotificationTemplates;