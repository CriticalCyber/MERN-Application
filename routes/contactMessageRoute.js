const express = require('express');
const { 
  createContactMessage, 
  getAllContactMessages, 
  getSingleContactMessage, 
  deleteContactMessage 
} = require('../controllers/contactMessageController');

// Import admin authentication middleware
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

// Public route for creating contact messages
router.route('/contact').post(createContactMessage);

// Admin routes for managing contact messages
router
  .route('/admin/messages')
  .get(isAuthenticatedAdmin, getAllContactMessages);

router
  .route('/admin/messages/:id')
  .get(isAuthenticatedAdmin, getSingleContactMessage)
  .delete(isAuthenticatedAdmin, deleteContactMessage);

module.exports = router;