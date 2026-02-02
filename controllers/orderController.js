const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const OtpUser = require('../models/OtpUser');
const ErrorHandler = require('../utils/errorHandler');
// Import sanitization utilities
const { sanitizeInput, sanitizeDbQuery } = require('../utils/sanitize');
// Import mongoose for transactions
const mongoose = require('mongoose');
const Delivery = require('../models/deliveryModel');
// Import socket event emitters
const { 
    emitOrderCreated, 
    emitOrderUpdated, 
    emitOrderDeleted 
} = require('../utils/socketEvents');
// Import cache manager
const { invalidateCache } = require('../utils/cacheManager');
// Import direct MSG91 SMS service
const { sendMSG91SMS } = require("../services/msg91Service");
// Import inventory service
const inventoryService = require('../services/inventoryService');

// COD Minimum Order Value Configuration
const COD_MIN_ORDER_VALUE = 199;

// Create New Order
exports.newOrder = asyncErrorHandler(async (req, res, next) => {
    // Log order creation attempt for monitoring
    console.log(`ORDER_CREATION_ATTEMPT: User ${req.user._id} attempting to create order with ${req.body.orderItems?.length || 0} items, total: ₹${req.body.totalPrice || 0}`);
    // Sanitize inputs
    if (req.body.shippingInfo) {
        req.body.shippingInfo.address = sanitizeInput(req.body.shippingInfo.address);
        req.body.shippingInfo.city = sanitizeInput(req.body.shippingInfo.city);
        req.body.shippingInfo.state = sanitizeInput(req.body.shippingInfo.state);
        req.body.shippingInfo.country = sanitizeInput(req.body.shippingInfo.country);
        req.body.shippingInfo.phoneNo = sanitizeInput(req.body.shippingInfo.phoneNo);
        req.body.shippingInfo.pinCode = sanitizeInput(req.body.shippingInfo.pinCode);
    }

    const {
        shippingInfo,
        orderItems,
        paymentInfo,
        itemsPrice,          // Subtotal before discount
        discountAmount,      // Total discount applied
        couponCode,          // Coupon code used
        couponDiscount,      // Discount from coupon
        deliveryCharge,      // Delivery charges
        totalPrice,
        paymentMethod = 'ONLINE'
    } = req.body;

    // Add idempotency protection - check for recent duplicate orders
    const idempotencyKey = req.headers['idempotency-key'] || 
        `${req.user._id}-${JSON.stringify(orderItems)}-${totalPrice}`;
    
    // Check for duplicate order within last 10 seconds
    const recentOrder = await Order.findOne({
        user: req.user._id,
        totalPrice: totalPrice,
        createdAt: { $gte: new Date(Date.now() - 10000) } // Last 10 seconds
    });

    if (recentOrder) {
        console.log(`Duplicate order attempt detected for user ${req.user._id}`);
        return res.status(200).json({
            success: true,
            order: recentOrder,
            message: "Order already processed"
        });
    }

    const orderExist = await Order.findOne({ paymentInfo: sanitizeDbQuery(paymentInfo) });

    if (orderExist) {
        return next(new ErrorHandler("Order Already Placed", 400));
    }

    // Server-side validation of pricing calculation
    const calculatedItemsPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const calculatedTotal = calculatedItemsPrice - (discountAmount || 0) + (deliveryCharge || 0);
    
    // Allow small rounding differences (up to 1 rupee)
    if (Math.abs(calculatedTotal - totalPrice) > 1) {
        console.log(`ORDER_PRICE_MISMATCH: Calculated: ₹${calculatedTotal}, Received: ₹${totalPrice}, Items: ₹${calculatedItemsPrice}, Discount: ₹${discountAmount}, Delivery: ₹${deliveryCharge}`);
        return next(new ErrorHandler("Price calculation mismatch. Please refresh and try again.", 400));
    }

    // Enforce COD minimum order value
    if (paymentMethod === 'COD' && totalPrice < COD_MIN_ORDER_VALUE) {
        return next(new ErrorHandler(
            `Cash on Delivery is available only for orders of ₹${COD_MIN_ORDER_VALUE} or more. Your cart total is ₹${totalPrice}. Please add more items to qualify for COD or choose online payment.`, 
            400
        ));
    }

    // Start a MongoDB session for transactions
    const session = await mongoose.startSession();
    
    try {
        // Start transaction
        session.startTransaction();
        
        // Create order within transaction WITH discount fields
        const orderData = {
            shippingInfo,
            orderItems,
            paymentInfo,
            itemsPrice: itemsPrice || calculatedItemsPrice,  // Use provided or calculated
            discountAmount: discountAmount || 0,
            couponCode: couponCode || null,
            couponDiscount: couponDiscount || 0,
            deliveryCharge: deliveryCharge || 0,
            totalPrice,
            user: req.user._id,
        };

        // Set paidAt only for online payments
        if (paymentMethod === 'ONLINE' || paymentInfo.status === 'paid') {
            orderData.paidAt = Date.now();
        }

        const order = await Order.create([orderData], { session: session });
        
        // Reserve stock for each product in the order with user-level locking
        for (const item of orderItems) {
            try {
                await inventoryService.reserveStock(item.product, item.quantity, order[0]._id.toString(), req.user._id.toString());
            } catch (error) {
                // Log stock reservation failure
                console.log(`STOCK_RESERVATION_FAILED: User ${req.user._id}, Product ${item.product}, Quantity ${item.quantity}, Error: ${error.message}`);
                
                // Rollback: Release any previously reserved stock
                for (const rollbackItem of orderItems) {
                    if (rollbackItem === item) break; // Stop at the failed item
                    try {
                        await inventoryService.releaseReservedStock(rollbackItem.product, rollbackItem.quantity, `ROLLBACK-${order[0]._id.toString()}`);
                    } catch (rollbackError) {
                        console.error(`Failed to rollback stock for ${rollbackItem.name}:`, rollbackError);
                    }
                }
                
                await session.abortTransaction();
                session.endSession();
                return next(new ErrorHandler(`Stock reservation failed for ${item.name}: ${error.message}`, 400));
            }
        }
        
        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Log successful order creation with discount info
        console.log(`ORDER_CREATED_SUCCESS: Order ${order[0]._id} created for user ${req.user._id}, total: ₹${order[0].totalPrice}, discount: ₹${order[0].discountAmount || 0}${order[0].couponCode ? `, coupon: ${order[0].couponCode}` : ''}`);
        
        // Send immediate HTTP response - MUST be sent before any background processing
        res.status(201).json({
            success: true,
            order: order[0],
            message: "Order confirmed successfully"
        });
        
        // Non-blocking customer SMS notification processing - MUST NOT affect response
        // Wrapped in try-catch and setImmediate to ensure zero impact on HTTP response
        try {
            setImmediate(() => {
                try {
                    // Send direct MSG91 DLT Flow SMS if user has mobile number
                    if (req.user?.mobile) {
                        sendMSG91SMS({
                            mobile: req.user.mobile,
                            templateId: process.env.MSG91_ORDER_CONFIRM_TEMPLATE_ID,
                            variables: {
                                VAR1: order[0]._id,  // Order ID
                                VAR2: order[0].totalPrice  // Order amount
                            }
                        }).catch(err => console.error('Customer SMS notification failed:', err));
                    }
                    
                    // Emit socket event for order creation (keep existing functionality)
                    const io = req.app.get('io');
                    emitOrderCreated(io, order[0]);
                    
                    // Invalidate cache
                    invalidateCache('orders').catch(err => console.error('Cache invalidation failed:', err));
                    
                    console.log(`ORDER_CONFIRMED: Order ${order[0]._id} confirmed for user ${req.user._id}`);
                } catch (error) {
                    console.error('Non-blocking notification error:', error);
                    // Never throw - this is background processing
                }
            });
        } catch (immediateError) {
            // This should never happen, but extra safety
            console.error('setImmediate setup failed:', immediateError);
        }
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler("Order creation failed", 500));
    }
});

// Get Single Order Details
exports.getSingleOrderDetails = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id).populate({
    path: "user",
    select: "name email mobile",
    model: "OtpUser"
}).lean();

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        order,
    });
});


// Get Logged In User Orders
exports.myOrders = asyncErrorHandler(async (req, res, next) => {

    const orders = await Order.find({ user: sanitizeDbQuery(req.user._id) }).select('-__v').lean();

    if (!orders) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        orders,
    });
});


// Get All Orders ---ADMIN
exports.getAllOrders = asyncErrorHandler(async (req, res, next) => {
    const resultPerPage = Number(req.query.limit) || 20;
    const currentPage = Number(req.query.page) || 1;
    
    // Validate pagination parameters
    if (resultPerPage > 100) {
        return next(new ErrorHandler("Limit cannot exceed 100", 400));
    }
    
    if (currentPage < 1) {
        return next(new ErrorHandler("Page must be greater than 0", 400));
    }
    
    // Build filter object for counting
    const filter = {};
    if (req.query.status) {
        filter.orderStatus = req.query.status;
    }
    
    // Use estimatedDocumentCount for better performance when no filters
    let ordersCount;
    if (Object.keys(filter).length === 0) {
        ordersCount = await Order.estimatedDocumentCount();
    } else {
        ordersCount = await Order.countDocuments(filter);
    }
    
    // Apply pagination with filters - include discount fields in selection
    const orders = await Order.find(filter)
        .select('orderItems user totalPrice itemsPrice discountAmount couponCode deliveryCharge orderStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(resultPerPage)
        .skip(resultPerPage * (currentPage - 1))
        .lean();

    // Calculate total amount and total discount efficiently using reduce
    const totalAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);
    
    // Add memory usage logging for monitoring
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    
    if (heapUsedMB > 800) { // Log if memory usage is high
        console.warn(`High memory usage detected in getAllOrders: ${heapUsedMB}MB`);
    }

    res.status(200).json({
        success: true,
        orders,
        ordersCount,
        resultPerPage,
        currentPage,
        totalAmount,
        totalDiscount,  // Include total discount in response
        // Include memory stats in response for debugging
        memoryStats: {
            heapUsed: heapUsedMB,
            rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100
        }
    });
})

// Update Order Status ---ADMIN
exports.updateOrder = asyncErrorHandler(async (req, res, next) => {
    // Sanitize status input
    req.body.status = sanitizeInput(req.body.status);

    // Start a MongoDB session for transactions
    const session = await mongoose.startSession();
    
    try {
        // Start transaction
        session.startTransaction();
        
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorHandler("Order Not Found", 404));
        }

        if (order.orderStatus === "Delivered") {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorHandler("Already Delivered", 400));
        }

        if (req.body.status === "Shipped") {
            order.shippedAt = Date.now();
            // Fulfill reserved stock for each product in the order
            for (const item of order.orderItems) {
                try {
                    await inventoryService.fulfillReservedStock(item.product, item.quantity, order._id.toString());
                } catch (error) {
                    // If reserved stock is insufficient, check if we can directly reduce stock
                    // This handles orders created before inventory reservation system or failed reservations
                    if (error.message.includes('Insufficient reserved stock')) {
                        try {
                            console.log(`No reserved stock found for order ${order._id}, attempting direct stock reduction for ${item.name}`);
                            
                            // Find the product and reduce stock directly
                            const product = await Product.findById(item.product).session(session);
                            
                            if (!product) {
                                throw new Error(`Product not found: ${item.name}`);
                            }
                            
                            if (product.stock < item.quantity) {
                                throw new Error(`Insufficient stock available. Available: ${product.stock}, Required: ${item.quantity}`);
                            }
                            
                            // Reduce stock directly
                            product.stock -= item.quantity;
                            await product.save({ session: session });
                            
                            console.log(`Successfully reduced stock directly for ${item.name}. New stock: ${product.stock}`);
                        } catch (directReductionError) {
                            await session.abortTransaction();
                            session.endSession();
                            return next(new ErrorHandler(`Stock fulfillment failed for ${item.name}: ${directReductionError.message}`, 400));
                        }
                    } else {
                        await session.abortTransaction();
                        session.endSession();
                        return next(new ErrorHandler(`Stock fulfillment failed for ${item.name}: ${error.message}`, 400));
                    }
                }
            }
            
            // Update delivery status for local delivery
            if (order.deliveryType === 'LOCAL') {
                order.deliveryStatus = 'Packed';
                
                try {
                    // Generate unique delivery ID
                    const deliveryId = `LOCAL-${order._id.toString().slice(-6)}-${Date.now()}`;
                    
                    // Determine payment method for delivery
                    const isPaid = order.paymentInfo && order.paymentInfo.status === 'paid';
                    const deliveryPaymentMethod = isPaid ? 'Prepaid' : 'COD';
                    const codAmount = isPaid ? 0 : order.totalPrice;
                    
                    const delivery = new Delivery({
                        orderId: order._id,
                        deliveryId: deliveryId,
                        deliveryType: 'LOCAL',
                        deliveryStatus: 'packed',
                        totalWeight: order.orderItems.reduce((total, item) => total + (item.weight || 100), 0), // Default 100g per item
                        declaredValue: order.totalPrice,
                        paymentMethod: deliveryPaymentMethod,
                        codAmount: codAmount,
                        statusHistory: [{
                            status: 'packed',
                            statusMessage: 'Order packed and ready for delivery',
                            date: new Date()
                        }]
                    });
                    
                    await delivery.save({ session: session });
                    
                    // Update order with delivery tracking
                    order.trackingId = deliveryId;
                } catch (deliveryError) {
                    // Log the error but don't fail the order update
                    console.error('Failed to create delivery record:', deliveryError.message);
                    console.log('Continuing order update without delivery record');
                }
            }
        }

        order.orderStatus = req.body.status;
        
        // Update delivery status based on order status
        if (req.body.status === "Shipped") {
            order.deliveryStatus = 'Out for Delivery'; // For local delivery
        } else if (req.body.status === "Delivered") {
            order.deliveredAt = Date.now();
            order.deliveryStatus = 'Delivered';
        }

        await order.save({ validateBeforeSave: false, session: session });
        
        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        // Emit socket event for order update
        const io = req.app.get('io');
        emitOrderUpdated(io, order);
        
        // Shipped and Delivered notifications disabled - using direct MSG91 DLT Flow only
        
        // Invalidate cache
        await invalidateCache('orders');
        
        res.status(200).json({
            success: true
        });
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();
        
        // Log the actual error for debugging
        console.error('Order update error:', error);
        
        return next(new ErrorHandler("Order update failed", 500));
    }
});

// Delete Order ---ADMIN
exports.deleteOrder = asyncErrorHandler(async (req, res, next) => {
    // Start a MongoDB session for transactions
    const session = await mongoose.startSession();
    
    try {
        // Start transaction
        session.startTransaction();
        
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorHandler("Order Not Found", 404));
        }

        console.log(`ORDER_DELETION_ATTEMPT: Deleting order ${order._id} with status ${order.orderStatus}`);

        // Handle inventory restoration based on order status
        // Only restore inventory if order hasn't been fulfilled yet
        if (order.orderStatus === 'Processing' || order.orderStatus === 'Confirmed') {
            // For orders that are still in processing/confirmed status, release reserved stock
            for (const item of order.orderItems) {
                try {
                    await inventoryService.releaseReservedStock(item.product, item.quantity, order._id.toString());
                    console.log(`Released reserved stock for product ${item.product}, quantity ${item.quantity}`);
                } catch (error) {
                    console.warn(`Failed to release reserved stock for product ${item.product}: ${error.message}`);
                    // Continue with deletion even if stock release fails
                }
            }
        } else if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
            // For shipped/delivered orders, we need to add stock back since it was already fulfilled
            for (const item of order.orderItems) {
                try {
                    await inventoryService.addStock(item.product, item.quantity, `ORDER_DELETION_${order._id}`, 'system', `Restored from deleted order ${order._id}`);
                    console.log(`Restored stock for product ${item.product}, quantity ${item.quantity}`);
                } catch (error) {
                    console.warn(`Failed to restore stock for product ${item.product}: ${error.message}`);
                    // Continue with deletion even if stock restoration fails
                }
            }
        } else {
            // For other statuses, try to release reserved stock
            for (const item of order.orderItems) {
                try {
                    await inventoryService.releaseReservedStock(item.product, item.quantity, order._id.toString());
                    console.log(`Released stock for product ${item.product}, quantity ${item.quantity}`);
                } catch (error) {
                    console.warn(`Failed to release stock for product ${item.product}: ${error.message}`);
                    // Continue with deletion even if stock release fails
                }
            }
        }

        // FIXED: Use deleteOne() instead of deprecated remove()
        await Order.deleteOne({ _id: order._id }, { session: session });
        
        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        
        console.log(`ORDER_DELETED_SUCCESS: Order ${order._id} deleted successfully`);
        
        // Emit socket event for order deletion
        const io = req.app.get('io');
        emitOrderDeleted(io, req.params.id, order.user);
        
        // Invalidate cache
        await invalidateCache('orders');
        
        res.status(200).json({
            success: true,
            message: "Order deleted successfully"
        });
    } catch (error) {
        console.error('ORDER_DELETION_ERROR:', error);
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();
        
        // Provide more specific error message
        let errorMessage = "Order deletion failed";
        if (error.message) {
            errorMessage = `Order deletion failed: ${error.message}`;
        }
        
        return next(new ErrorHandler(errorMessage, 500));
    }
});