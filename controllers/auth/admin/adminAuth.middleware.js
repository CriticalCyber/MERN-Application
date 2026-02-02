// Admin Authentication Middleware
// Checks for admin JWT token in cookies

const { isAuthenticatedAdmin } = require('../../../middlewares/adminAuth.middleware');

exports.adminAuth = (req, res, next) => {
  // Delegate to the new JWT-based admin authentication middleware
  return isAuthenticatedAdmin(req, res, next);
};