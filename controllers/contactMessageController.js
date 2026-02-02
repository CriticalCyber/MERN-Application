const ContactMessage = require('../models/contactMessageModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { sanitizeInput } = require('../utils/sanitize');

// @desc    Create a new contact message
// @route   POST /api/v1/contact
// @access  Public
const createContactMessage = asyncErrorHandler(async (req, res, next) => {
  // Sanitize input data
  const sanitizedData = {
    name: req.body.name ? sanitizeInput(req.body.name) : '',
    email: req.body.email ? sanitizeInput(req.body.email).toLowerCase() : '',
    phone: req.body.phone ? sanitizeInput(req.body.phone) : undefined,
    subject: req.body.subject ? sanitizeInput(req.body.subject) : '',
    message: req.body.message ? sanitizeInput(req.body.message) : ''
  };

  // Validate required fields
  if (!sanitizedData.name.trim() || !sanitizedData.email.trim() || !sanitizedData.subject.trim() || !sanitizedData.message.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, subject, and message'
    });
  }

  // Create new contact message
  try {
    const contactMessage = await ContactMessage.create(sanitizedData);
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: contactMessage._id
      }
    });
  } catch (dbError) {
    console.error('Error creating contact message:', dbError);
    
    // Check if it's a validation error
    if (dbError.name === 'ValidationError') {
      const errors = Object.values(dbError.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + errors.join(', ')
      });
    }
    
    // For other errors
    return res.status(500).json({
      success: false,
      message: 'Internal server error while saving message'
    });
  }
});

// @desc    Get all contact messages (Admin only)
// @route   GET /api/v1/admin/messages
// @access  Private/Admin
const getAllContactMessages = asyncErrorHandler(async (req, res, next) => {
  // Sort by newest first (createdAt descending)
  const contactMessages = await ContactMessage.find({})
    .sort({ createdAt: -1 })
    .select('-__v'); // Exclude version field

  res.status(200).json({
    success: true,
    count: contactMessages.length,
    data: contactMessages
  });
});

// @desc    Get single contact message (Admin only)
// @route   GET /api/v1/admin/messages/:id
// @access  Private/Admin
const getSingleContactMessage = asyncErrorHandler(async (req, res, next) => {
  const contactMessage = await ContactMessage.findById(req.params.id).select('-__v');

  if (!contactMessage) {
    return res.status(404).json({
      success: false,
      message: 'Contact message not found'
    });
  }

  // Mark message as read
  contactMessage.isRead = true;
  await contactMessage.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: contactMessage
  });
});

// @desc    Delete contact message (Admin only)
// @route   DELETE /api/v1/admin/messages/:id
// @access  Private/Admin
const deleteContactMessage = asyncErrorHandler(async (req, res, next) => {
  const contactMessage = await ContactMessage.findById(req.params.id);

  if (!contactMessage) {
    return res.status(404).json({
      success: false,
      message: 'Contact message not found'
    });
  }

  await contactMessage.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Contact message deleted successfully'
  });
});

module.exports = {
  createContactMessage,
  getAllContactMessages,
  getSingleContactMessage,
  deleteContactMessage
};