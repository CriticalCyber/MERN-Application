const CODSettlement = require('../models/codSettlementModel');
const Order = require('../models/orderModel');
const Delivery = require('../models/deliveryModel'); // Updated model name
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { ErrorHandler } = require('../utils/errorHandler');

// Get all COD settlements with filtering
const getAllCODSettlements = asyncErrorHandler(async (req, res, next) => {
    // Only admin can access this
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler('Only admin can view COD settlements', 403));
    }

    try {
        // Extract query parameters for filtering
        const { status, courier, startDate, endDate, page = 1, limit = 10 } = req.query;

        // Build filter object
        let filter = {};

        if (status) {
            filter.settlementStatus = status;
        }

        if (courier) {
            // Filter by either courierName (for backward compatibility) or deliveryCompany
            filter.$or = [
                { courierName: { $regex: courier, $options: 'i' } },
                { deliveryCompany: { $regex: courier, $options: 'i' } }
            ];
        }

        if (startDate || endDate) {
            filter.settlementDate = {};
            if (startDate) {
                filter.settlementDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.settlementDate.$lte = new Date(endDate);
            }
        }

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get settlements with populated order and shipment info
        const settlements = await CODSettlement.find(filter)
            .populate('order', 'orderStatus totalPrice createdAt')
            .populate('shipment', 'trackingId deliveryStatus shippedAt deliveredAt') // Use delivery fields
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await CODSettlement.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: settlements.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            settlements
        });
    } catch (error) {
        console.error('Error fetching COD settlements:', error);
        return next(new ErrorHandler(`Failed to fetch COD settlements: ${error.message}`, 500));
    }
});

// Get COD settlement summary
const getCODSettlementSummary = asyncErrorHandler(async (req, res, next) => {
    // Only admin can access this
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler('Only admin can view COD settlement summary', 403));
    }

    try {
        // Get summary data
        const summary = await CODSettlement.aggregate([
            {
                $group: {
                    _id: null,
                    totalCODAmount: { $sum: "$codAmount" },
                    totalSettledAmount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "SETTLED"] }, "$codAmount", 0] 
                        } 
                    },
                    totalPendingAmount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "PENDING"] }, "$codAmount", 0] 
                        } 
                    },
                    totalProcessingAmount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "PROCESSING"] }, "$codAmount", 0] 
                        } 
                    },
                    totalFailedAmount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "FAILED"] }, "$codAmount", 0] 
                        } 
                    },
                    totalCount: { $sum: 1 },
                    settledCount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "SETTLED"] }, 1, 0] 
                        } 
                    },
                    pendingCount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "PENDING"] }, 1, 0] 
                        } 
                    },
                    processingCount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "PROCESSING"] }, 1, 0] 
                        } 
                    },
                    failedCount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "FAILED"] }, 1, 0] 
                        } 
                    }
                }
            }
        ]);

        // Get delivery company-wise summary
        const deliveryCompanySummary = await CODSettlement.aggregate([
            {
                $group: {
                    _id: "$deliveryCompany",
                    totalCODAmount: { $sum: "$codAmount" },
                    totalSettledAmount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "SETTLED"] }, "$codAmount", 0] 
                        } 
                    },
                    count: { $sum: 1 },
                    settledCount: { 
                        $sum: { 
                            $cond: [{ $eq: ["$settlementStatus", "SETTLED"] }, 1, 0] 
                        } 
                    }
                }
            }
        ]);

        // Get date-wise summary for the last 30 days
        const dateRange = new Date();
        dateRange.setDate(dateRange.getDate() - 30);

        const dateSummary = await CODSettlement.aggregate([
            {
                $match: {
                    settlementDate: { $gte: dateRange }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$settlementDate" }
                    },
                    totalCODAmount: { $sum: "$codAmount" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            summary: summary[0] || {
                totalCODAmount: 0,
                totalSettledAmount: 0,
                totalPendingAmount: 0,
                totalProcessingAmount: 0,
                totalFailedAmount: 0,
                totalCount: 0,
                settledCount: 0,
                pendingCount: 0,
                processingCount: 0,
                failedCount: 0
            },
            deliveryCompanySummary,
            dateSummary
        });
    } catch (error) {
        console.error('Error fetching COD settlement summary:', error);
        return next(new ErrorHandler(`Failed to fetch COD settlement summary: ${error.message}`, 500));
    }
});

// Get single COD settlement by ID
const getCODSettlementById = asyncErrorHandler(async (req, res, next) => {
    // Only admin can access this
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler('Only admin can view COD settlement details', 403));
    }

    try {
        const { id } = req.params;

        const settlement = await CODSettlement.findById(id)
            .populate('order', 'orderStatus totalPrice createdAt')
            .populate('shipment', 'trackingId deliveryStatus shippedAt deliveredAt'); // Use delivery fields

        if (!settlement) {
            return next(new ErrorHandler('COD settlement not found', 404));
        }

        res.status(200).json({
            success: true,
            settlement
        });
    } catch (error) {
        console.error('Error fetching COD settlement:', error);
        return next(new ErrorHandler(`Failed to fetch COD settlement: ${error.message}`, 500));
    }
});

// Update COD settlement (for matching with bank records)
const updateCODSettlement = asyncErrorHandler(async (req, res, next) => {
    // Only admin can access this
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler('Only admin can update COD settlement', 403));
    }

    try {
        const { id } = req.params;
        const { bankUTR, settlementStatus, settlementNotes, matchedWithBank } = req.body;

        const updateData = {};

        if (bankUTR !== undefined) updateData.bankUTR = bankUTR;
        if (settlementStatus !== undefined) updateData.settlementStatus = settlementStatus;
        if (settlementNotes !== undefined) updateData.settlementNotes = settlementNotes;
        if (matchedWithBank !== undefined) {
            updateData.matchedWithBank = matchedWithBank;
            if (matchedWithBank) {
                updateData.matchedDate = new Date();
            }
        }

        const settlement = await CODSettlement.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('order', 'orderStatus totalPrice createdAt')
         .populate('shipment', 'trackingId deliveryStatus shippedAt deliveredAt'); // Use delivery fields

        if (!settlement) {
            return next(new ErrorHandler('COD settlement not found', 404));
        }

        res.status(200).json({
            success: true,
            settlement
        });
    } catch (error) {
        console.error('Error updating COD settlement:', error);
        return next(new ErrorHandler(`Failed to update COD settlement: ${error.message}`, 500));
    }
});

// Export COD settlements to CSV
const exportCODSettlements = asyncErrorHandler(async (req, res, next) => {
    // Only admin can access this
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler('Only admin can export COD settlements', 403));
    }

    try {
        // Extract query parameters for filtering
        const { status, courier, startDate, endDate } = req.query;

        // Build filter object
        let filter = {};

        if (status) {
            filter.settlementStatus = status;
        }

        if (courier) {
            // Filter by either courierName (for backward compatibility) or deliveryCompany
            filter.$or = [
                { courierName: { $regex: courier, $options: 'i' } },
                { deliveryCompany: { $regex: courier, $options: 'i' } }
            ];
        }

        if (startDate || endDate) {
            filter.settlementDate = {};
            if (startDate) {
                filter.settlementDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.settlementDate.$lte = new Date(endDate);
            }
        }

        // Get settlements with populated order and shipment info
        const settlements = await CODSettlement.find(filter)
            .populate('order', 'orderStatus totalPrice createdAt')
            .populate('shipment', 'trackingId deliveryStatus shippedAt deliveredAt') // Use delivery fields
            .sort({ createdAt: -1 });

        // Prepare CSV data
        const csvHeader = [
            'Order ID',
            'Tracking ID',
            'COD Amount',
            'Delivery Company',
            'Settlement Status',
            'Settlement Date',
            'Bank UTR',
            'Matched With Bank',
            'Matched Date',
            'Settlement Notes',
            'Created At',
            'Updated At'
        ].join(',');

        const csvRows = settlements.map(settlement => {
            const values = [
                settlement.order ? settlement.order._id.toString() : '',
                settlement.trackingId || settlement.awb || '',
                settlement.codAmount || 0,
                settlement.deliveryCompany || settlement.courierName || '',
                settlement.settlementStatus || '',
                settlement.settlementDate ? new Date(settlement.settlementDate).toLocaleDateString() : '',
                settlement.bankUTR || '',
                settlement.matchedWithBank ? 'Yes' : 'No',
                settlement.matchedDate ? new Date(settlement.matchedDate).toLocaleDateString() : '',
                settlement.settlementNotes || '',
                new Date(settlement.createdAt).toLocaleDateString(),
                new Date(settlement.updatedAt).toLocaleDateString()
            ];

            // Escape values that contain commas
            const escapedValues = values.map(value => {
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            });

            return escapedValues.join(',');
        });

        const csvContent = [csvHeader, ...csvRows].join('\n');

        // Set headers for CSV download
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename=cod-settlements.csv');

        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting COD settlements:', error);
        return next(new ErrorHandler(`Failed to export COD settlements: ${error.message}`, 500));
    }
});

module.exports = {
    getAllCODSettlements,
    getCODSettlementSummary,
    getCODSettlementById,
    updateCODSettlement,
    exportCODSettlements
};