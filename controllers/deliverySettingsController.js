const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { ErrorHandler } = require('../utils/errorHandler');
const { DeliverySettings, DeliveryArea, DeliverySlot } = require('../models/deliveryModel');

// Get delivery settings
const getDeliverySettings = asyncErrorHandler(async (req, res, next) => {
    try {
        // Find delivery settings in database
        const deliverySettings = await DeliverySettings.findOne();
        
        if (!deliverySettings) {
            // Return default settings if none exist
            return res.status(200).json({
                success: true,
                settings: {
                    baseDeliveryCharge: 50,
                    freeDeliveryThreshold: 500,
                    maxDeliveryDistance: 20,
                    deliveryAreas: [],
                    deliverySlots: []
                }
            });
        }
        
        res.status(200).json({
            success: true,
            settings: deliverySettings
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to get delivery settings: ${error.message}`, 500));
    }
});

// Update delivery settings
const updateDeliverySettings = asyncErrorHandler(async (req, res, next) => {
    try {
        const updateData = req.body;
        
        // Find existing settings or create new ones
        const updatedSettings = await DeliverySettings.findOneAndUpdate({}, updateData, {
            new: true,
            upsert: true,
            runValidators: true
        });
        
        res.status(200).json({
            success: true,
            message: 'Delivery settings updated successfully',
            settings: updatedSettings
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to update delivery settings: ${error.message}`, 500));
    }
});

// Get all delivery areas
const getAllDeliveryAreas = asyncErrorHandler(async (req, res, next) => {
    try {
        const areas = await DeliveryArea.find({}).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            areas
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to get delivery areas: ${error.message}`, 500));
    }
});

// Get specific delivery area
const getDeliveryArea = asyncErrorHandler(async (req, res, next) => {
    try {
        const area = await DeliveryArea.findById(req.params.id);
        
        if (!area) {
            return next(new ErrorHandler('Delivery area not found', 404));
        }
        
        res.status(200).json({
            success: true,
            area
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to get delivery area: ${error.message}`, 500));
    }
});

// Create delivery area
const createDeliveryArea = asyncErrorHandler(async (req, res, next) => {
    try {
        const areaData = req.body;
        
        // Validate required fields
        if (!areaData.name || !areaData.pincode || !areaData.city || !areaData.state) {
            return next(new ErrorHandler('Name, pincode, city, and state are required', 400));
        }
        
        // Check if pincode already exists
        const existingArea = await DeliveryArea.findOne({ pincode: areaData.pincode });
        if (existingArea) {
            return next(new ErrorHandler('Delivery area with this pincode already exists', 400));
        }
        
        const newArea = await DeliveryArea.create(areaData);
        
        res.status(201).json({
            success: true,
            message: 'Delivery area created successfully',
            area: newArea
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to create delivery area: ${error.message}`, 500));
    }
});

// Update delivery area
const updateDeliveryArea = asyncErrorHandler(async (req, res, next) => {
    try {
        const areaData = req.body;
        
        const updatedArea = await DeliveryArea.findByIdAndUpdate(
            req.params.id,
            areaData,
            {
                new: true,
                runValidators: true
            }
        );
        
        if (!updatedArea) {
            return next(new ErrorHandler('Delivery area not found', 404));
        }
        
        res.status(200).json({
            success: true,
            message: 'Delivery area updated successfully',
            area: updatedArea
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to update delivery area: ${error.message}`, 500));
    }
});

// Delete delivery area
const deleteDeliveryArea = asyncErrorHandler(async (req, res, next) => {
    try {
        const deletedArea = await DeliveryArea.findByIdAndDelete(req.params.id);
        
        if (!deletedArea) {
            return next(new ErrorHandler('Delivery area not found', 404));
        }
        
        res.status(200).json({
            success: true,
            message: 'Delivery area deleted successfully'
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to delete delivery area: ${error.message}`, 500));
    }
});

// Toggle delivery area status
const toggleDeliveryAreaStatus = asyncErrorHandler(async (req, res, next) => {
    try {
        const area = await DeliveryArea.findById(req.params.id);
        
        if (!area) {
            return next(new ErrorHandler('Delivery area not found', 404));
        }
        
        area.isServicable = !area.isServicable;
        await area.save();
        
        res.status(200).json({
            success: true,
            message: 'Delivery area status toggled successfully',
            status: area.isServicable
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to toggle delivery area status: ${error.message}`, 500));
    }
});

// Get all delivery slots
const getAllDeliverySlots = asyncErrorHandler(async (req, res, next) => {
    try {
        const slots = await DeliverySlot.find({}).sort({ startTime: 1 });
        
        res.status(200).json({
            success: true,
            slots
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to get delivery slots: ${error.message}`, 500));
    }
});

// Get specific delivery slot
const getDeliverySlot = asyncErrorHandler(async (req, res, next) => {
    try {
        const slot = await DeliverySlot.findById(req.params.id);
        
        if (!slot) {
            return next(new ErrorHandler('Delivery slot not found', 404));
        }
        
        res.status(200).json({
            success: true,
            slot
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to get delivery slot: ${error.message}`, 500));
    }
});

// Create delivery slot
const createDeliverySlot = asyncErrorHandler(async (req, res, next) => {
    try {
        const slotData = req.body;
        
        // Validate required fields
        if (!slotData.startTime || !slotData.endTime) {
            return next(new ErrorHandler('Start time and end time are required', 400));
        }
        
        // Check if time range is valid
        if (slotData.startTime >= slotData.endTime) {
            return next(new ErrorHandler('Start time must be before end time', 400));
        }
        
        const newSlot = await DeliverySlot.create(slotData);
        
        res.status(201).json({
            success: true,
            message: 'Delivery slot created successfully',
            slot: newSlot
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to create delivery slot: ${error.message}`, 500));
    }
});

// Update delivery slot
const updateDeliverySlot = asyncErrorHandler(async (req, res, next) => {
    try {
        const slotData = req.body;
        
        const updatedSlot = await DeliverySlot.findByIdAndUpdate(
            req.params.id,
            slotData,
            {
                new: true,
                runValidators: true
            }
        );
        
        if (!updatedSlot) {
            return next(new ErrorHandler('Delivery slot not found', 404));
        }
        
        res.status(200).json({
            success: true,
            message: 'Delivery slot updated successfully',
            slot: updatedSlot
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to update delivery slot: ${error.message}`, 500));
    }
});

// Delete delivery slot
const deleteDeliverySlot = asyncErrorHandler(async (req, res, next) => {
    try {
        const deletedSlot = await DeliverySlot.findByIdAndDelete(req.params.id);
        
        if (!deletedSlot) {
            return next(new ErrorHandler('Delivery slot not found', 404));
        }
        
        res.status(200).json({
            success: true,
            message: 'Delivery slot deleted successfully'
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to delete delivery slot: ${error.message}`, 500));
    }
});

// Toggle delivery slot status
const toggleDeliverySlotStatus = asyncErrorHandler(async (req, res, next) => {
    try {
        const slot = await DeliverySlot.findById(req.params.id);
        
        if (!slot) {
            return next(new ErrorHandler('Delivery slot not found', 404));
        }
        
        slot.isActive = !slot.isActive;
        await slot.save();
        
        res.status(200).json({
            success: true,
            message: 'Delivery slot status toggled successfully',
            status: slot.isActive
        });
    } catch (error) {
        return next(new ErrorHandler(`Failed to toggle delivery slot status: ${error.message}`, 500));
    }
});

module.exports = {
    getDeliverySettings,
    updateDeliverySettings,
    getAllDeliveryAreas,
    getDeliveryArea,
    createDeliveryArea,
    updateDeliveryArea,
    deleteDeliveryArea,
    toggleDeliveryAreaStatus,
    getAllDeliverySlots,
    getDeliverySlot,
    createDeliverySlot,
    updateDeliverySlot,
    deleteDeliverySlot,
    toggleDeliverySlotStatus
};