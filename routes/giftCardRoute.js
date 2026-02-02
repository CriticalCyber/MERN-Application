const express = require('express');
const {
  getAllGiftCards,
  getGiftCard,
  createGiftCard,
  updateGiftCard,
  deleteGiftCard,
  applyGiftCard,
  useGiftCard
} = require('../controllers/giftCardController');

const { isAuthenticatedUser } = require('../middlewares/userAuth.middleware');
const { isAuthenticatedAdmin } = require('../middlewares/adminAuth.middleware');

const router = express.Router();

/* ===================== CUSTOMER ROUTES ===================== */

// Customer can VIEW gift cards
router.get('/giftcards', isAuthenticatedUser, getAllGiftCards);

// Customer can APPLY gift card
router.post('/giftcard/apply', isAuthenticatedUser, applyGiftCard);

// Customer can USE gift card
router.post('/giftcard/use', isAuthenticatedUser, useGiftCard);


/* ===================== ADMIN ROUTES ===================== */

// Admin create gift card
router.post('/admin/giftcard/new', isAuthenticatedAdmin, createGiftCard);

// Admin get / update / delete gift card
router.route('/admin/giftcard/:id')
  .get(isAuthenticatedAdmin, getGiftCard)
  .put(isAuthenticatedAdmin, updateGiftCard)
  .delete(isAuthenticatedAdmin, deleteGiftCard);

module.exports = router;
