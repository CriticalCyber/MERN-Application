const ErrorHandler = require('../utils/errorHandler');

/**
 * Middleware to check version for optimistic locking
 * @param {Object} model - Mongoose model
 * @returns {Function} Middleware function
 */
const checkVersion = (model) => {
  return async (req, res, next) => {
    try {
      // Only check version for PUT and PATCH requests
      if (req.method !== 'PUT' && req.method !== 'PATCH') {
        return next();
      }

      // Get the document ID from params
      const docId = req.params.id;
      if (!docId) {
        return next();
      }

      // Get version from request body
      const clientVersion = req.body.__v;
      if (clientVersion === undefined) {
        return next();
      }

      // Find the document and check version
      const doc = await model.findById(docId);
      if (!doc) {
        return next(new ErrorHandler('Document not found', 404));
      }

      // Check if versions match
      if (doc.__v !== clientVersion) {
        return next(new ErrorHandler('Document has been modified by another user. Please refresh and try again.', 409));
      }

      next();
    } catch (error) {
      next(new ErrorHandler('Version check failed', 500));
    }
  };
};

module.exports = checkVersion;