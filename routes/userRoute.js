const express = require('express');
const { getUserDetails } = require('../controllers/userController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');

const router = express.Router();

// Customer user management routes (Mobile OTP authentication)
router.route('/me').get(isAuthenticatedUser, getUserDetails);

module.exports = router;