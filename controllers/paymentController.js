const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Payment = require('../models/paymentModel');
const ErrorHandler = require('../utils/errorHandler');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');

// exports.processPayment = asyncErrorHandler(async (req, res, next) => {
//     const myPayment = await stripe.paymentIntents.create({
//         amount: req.body.amount,
//         currency: "inr",
//         metadata: {
//             company: "ShubhValueCart",
//         },
//     });

//     res.status(200).json({
//         success: true,
//         client_secret: myPayment.client_secret, 
//     });
// });

// Process Razorpay Payment
exports.processRazorpayPayment = asyncErrorHandler(async (req, res, next) => {
    const { amount, email, phoneNo } = req.body;

    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Create a receipt ID that's guaranteed to be under 40 characters
    const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const options = {
        amount: amount * 100, // amount in smallest currency unit
        currency: "INR",
        receipt: receiptId,  // Shortened to comply with 40-char limit
    };

    try {
        const order = await instance.orders.create(options);
        
        res.status(200).json({
            success: true,
            order,
        });
    } catch (error) {
        return next(new ErrorHandler(error.description || error.message, 400));
    }
});

// exports.sendStripeApiKey = asyncErrorHandler(async (req, res, next) => {
//     res.status(200).json({ stripeApiKey: process.env.STRIPE_API_KEY });
// });







exports.getPaymentStatus = asyncErrorHandler(async (req, res, next) => {

    const payment = await Payment.findOne({ orderId: req.params.id });

    if (!payment) {
        return next(new ErrorHandler("Payment Details Not Found", 404));
    }

    const txn = {
        id: payment.txnId,
        status: payment.resultInfo.resultStatus,
    }

    res.status(200).json({
        success: true,
        txn,
    });
});

// Verify Razorpay Payment
exports.verifyRazorpayPayment = asyncErrorHandler(async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const crypto = require("crypto");
    const secret = process.env.RAZORPAY_KEY_SECRET;

    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
        return next(new ErrorHandler("Transaction not legit!", 400));
    }

    // Save payment details to database
    const paymentData = {
        orderId: razorpay_order_id,
        txnId: razorpay_payment_id,
        resultInfo: {
            resultStatus: "TXN_SUCCESS",
        }
    };
    
    await Payment.create(paymentData);

    res.status(200).json({
        success: true,
        message: "Payment verified successfully",
    });
});
