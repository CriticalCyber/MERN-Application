const Order = require('../models/orderModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const inventoryService = require('../services/inventoryService');
const mongoose = require('mongoose');

/**
 * Handle payment success webhook - finalize reserved inventory
 */
exports.handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
    try {
        const { orderId, paymentId, status } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if payment is successful
        if (status !== 'success' && status !== 'TXN_SUCCESS' && status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Payment not successful'
            });
        }

        // Start a MongoDB session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // For each item in the order, finalize the reserved stock
            for (const item of order.orderItems) {
                try {
                    await inventoryService.finalizeStock(
                        item.product,
                        item.quantity,
                        `Payment Success - Order ${order._id}`
                    );
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: `Stock fulfillment failed for item: ${error.message}`
                    });
                }
            }

            // Update order payment status
            order.paymentInfo.status = 'paid';
            await order.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            // Update order status to 'Processing' if it was 'Created'
            if (order.orderStatus === 'Created') {
                order.orderStatus = 'Processing';
                await order.save();
            }

            res.status(200).json({
                success: true,
                message: 'Payment confirmed and inventory finalized successfully',
                orderId: order._id
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    } catch (error) {
        console.error('Payment success webhook error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Handle payment failure webhook - release reserved inventory
 */
exports.handlePaymentFailure = asyncErrorHandler(async (req, res) => {
    try {
        const { orderId, paymentId, status } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if payment failed
        if (status !== 'failure' && status !== 'TXN_FAILURE' && status !== 'failed' && status !== 'canceled') {
            return res.status(400).json({
                success: false,
                message: 'Payment was not marked as failed'
            });
        }

        // Start a MongoDB session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // For each item in the order, release the reserved stock
            for (const item of order.orderItems) {
                try {
                    await inventoryService.releaseReservedStock(
                        item.product,
                        item.quantity,
                        `Payment Failure - Order ${order._id}`
                    );
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: `Stock release failed for item: ${error.message}`
                    });
                }
            }

            // Update order payment status
            order.paymentInfo.status = 'failed';
            await order.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: 'Payment failed and inventory released successfully',
                orderId: order._id
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    } catch (error) {
        console.error('Payment failure webhook error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * Generic payment webhook handler that can handle different payment statuses
 */
exports.handlePaymentWebhook = asyncErrorHandler(async (req, res) => {
    try {
        const { orderId, paymentId, status, provider } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and status are required'
            });
        }

        // Determine action based on status
        if (status.toLowerCase().includes('success') || status === 'paid') {
            // Handle successful payment
            await exports.handlePaymentSuccess({ body: { orderId, paymentId, status } }, res);
        } else if (status.toLowerCase().includes('fail') || status === 'failed' || status === 'canceled') {
            // Handle failed/cancelled payment
            await exports.handlePaymentFailure({ body: { orderId, paymentId, status } }, res);
        } else {
            // Unknown status, acknowledge but don't process
            return res.status(200).json({
                success: true,
                message: 'Webhook received with unknown status, acknowledged',
                status
            });
        }
    } catch (error) {
        console.error('Generic payment webhook error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});