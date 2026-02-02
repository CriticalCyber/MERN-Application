const express = require("express");
const csrf = require("csurf");

const {
  adminLogin,
} = require("../controllers/auth/admin/adminLogin.controller");
const {
  adminLogout,
} = require("../controllers/auth/admin/adminLogout.controller");

const { isAuthenticatedAdmin } = require("../middlewares/adminAuth.middleware");
const upload = require("../middlewares/upload");
const { hybridUpload, hybridUploadSingle } = require("../middlewares/hybridUpload");
const { validateProductCreation, validateProductUpdate } = require("../middlewares/productValidation");


const {
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
} = require("../controllers/productController");

const {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

/**
 * CSRF Protection
 * Session-based (NOT cookie-based)
 */
const csrfProtection = csrf({ cookie: false });

/* ======================================================
   AUTH ROUTES (NO CSRF)
====================================================== */
router.post("/login", adminLogin);

// Get current admin user info
router.get(
  "/me",
  isAuthenticatedAdmin,
  (req, res) => {
    res.status(200).json({
      success: true,
      user: req.admin // Return full admin object from middleware
    });
  }
);

router.post(
  "/logout",
  isAuthenticatedAdmin,
  adminLogout
);

/* ======================================================
   CSRF TOKEN ROUTE (AFTER ADMIN LOGIN)
====================================================== */
router.get(
  "/csrf-token",
  isAuthenticatedAdmin,
  csrfProtection,
  (req, res) => {
    res.status(200).json({
      csrfToken: req.csrfToken(),
    });
  }
);

/* ======================================================
   PRODUCT ROUTES (ADMIN ONLY)
====================================================== */
router.get(
  "/products",
  isAuthenticatedAdmin,
  getAdminProducts
);

router.post(
  "/product/new",
  isAuthenticatedAdmin,
  csrfProtection,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "logo", maxCount: 1 }
  ]),
  validateProductCreation,
  createProduct
);

router.put(
  "/product/:id",
  isAuthenticatedAdmin,
  csrfProtection,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "logo", maxCount: 1 }
  ]),
  validateProductUpdate,
  updateProduct
);

router.delete(
  "/product/:id",
  isAuthenticatedAdmin,
  csrfProtection,
  deleteProduct
);

/* ======================================================
   CATEGORY ROUTES (ADMIN ONLY)
====================================================== */
router.get(
  "/categories",
  isAuthenticatedAdmin,
  getAllCategories
);

router.get(
  "/category/:id",
  isAuthenticatedAdmin,
  getCategory
);

router.post(
  "/category/new",
  isAuthenticatedAdmin,
  csrfProtection,
  hybridUploadSingle('image'),
  createCategory
);

router.put(
  "/category/:id",
  isAuthenticatedAdmin,
  csrfProtection,
  hybridUploadSingle('image'),
  updateCategory
);

router.delete(
  "/category/:id",
  isAuthenticatedAdmin,
  csrfProtection,
  deleteCategory
);

/* ======================================================
   POPUP EMAIL LEADS ROUTES (ADMIN ONLY)
====================================================== */
const { getPopupEmailLeads, deletePopupEmailLead } = require('../controllers/giftCardController');

// Import tax rate controller
const { getAllTaxRates } = require('../controllers/taxRateController');

// Import admin user management controller
const { getAllUsers, getSingleUser, updateUserRole, deleteUser } = require('../controllers/adminUserController');

router.get(
  "/popup-email-leads",
  isAuthenticatedAdmin,
  getPopupEmailLeads
);

router.delete(
  "/popup-email-lead/:id",
  isAuthenticatedAdmin,
  deletePopupEmailLead
);

/* ======================================================
   TAX RATES ROUTES (ADMIN ONLY)
====================================================== */
router.get(
  "/tax-rates",
  isAuthenticatedAdmin,
  getAllTaxRates
);

/* ======================================================
   USER MANAGEMENT ROUTES (ADMIN ONLY)
====================================================== */
router.route("/users")
  .get(isAuthenticatedAdmin, getAllUsers);

router.route("/user/:id")
  .get(isAuthenticatedAdmin, getSingleUser)
  .put(isAuthenticatedAdmin, updateUserRole)
  .delete(isAuthenticatedAdmin, deleteUser);

module.exports = router;
