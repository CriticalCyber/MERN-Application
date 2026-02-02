const express = require('express');
const { getPublicCategories } = require('../controllers/categoryController');
const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');

const router = express.Router();

// Public route for fetching categories (filtered by enabled status)
router.route('/public/categories').get(getPublicCategories);

module.exports = router;