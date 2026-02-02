const express = require('express');

const {
  getAllProducts,
  getProductsByCategory,
  getProductDetails,
  getProductReviews,
  deleteReview,
  createProductReview,
  getProducts,
  uploadAdditionalImages,
  getRelatedProducts
} = require('../controllers/productController');

const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const upload = require('../middlewares/upload');

const router = express.Router();

/* ===============================
   PUBLIC PRODUCT ROUTES
================================ */
router.route('/products').get(getAllProducts);
router.route('/products/all').get(getProducts);
router.route('/categories/:slug/products').get(getProductsByCategory);
router.route('/product/:id').get(getProductDetails);
router.route('/products/:id/related').get(getRelatedProducts);

/* ===============================
   USER ROUTES
================================ */
router.route('/review')
  .put(isAuthenticatedUser, createProductReview);

/* ===============================
   ADMIN REVIEW ROUTES
================================ */
router.route('/admin/reviews')
  .get(
    isAuthenticatedAdmin,
    getProductReviews
  )
  .delete(
    isAuthenticatedAdmin,
    deleteReview
  );

/* ===============================
   ADMIN PRODUCT IMAGE UPLOAD
================================ */
router.post(
  '/admin/products/:id/images',
  isAuthenticatedAdmin,

  upload.array('images', 5),
  uploadAdditionalImages
);

module.exports = router;
