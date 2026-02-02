/**
 * Utility functions for mobile number processing
 */

/**
 * Normalize Indian mobile number to E.164 format
 * Removes spaces, hyphens, parentheses, and ensures +91 prefix
 * @param {string} mobile - Raw mobile number
 * @returns {string} Normalized mobile number in E.164 format (+91XXXXXXXXXX)
 */
function normalizeIndianMobile(mobile) {
  if (!mobile) {
    throw new Error('Mobile number is required');
  }

  // Convert to string and remove all non-digit characters except +
  let cleaned = String(mobile).replace(/[^\d+]/g, '');

  // Remove any + that's not at the beginning
  if (cleaned.indexOf('+') > 0) {
    cleaned = cleaned.replace(/\+/g, '');
  }

  // Handle various Indian mobile number formats
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    // Already in +91XXXXXXXXXX format
    cleaned = cleaned.substring(1); // Remove + temporarily for processing
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Has 91 prefix without +
    // Already in correct format
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Has leading zero
    cleaned = '91' + cleaned.substring(1);
  } else if (cleaned.length === 10) {
    // Plain 10 digit number
    cleaned = '91' + cleaned;
  } else if (cleaned.startsWith('+') && cleaned.length === 13 && cleaned.substring(1, 3) === '91') {
    // Already has +91, convert to 91 format for processing
    cleaned = cleaned.substring(1);
  } else if (cleaned.length > 12) {
    // Too long, try to extract last 10 digits if starts with country code
    if (cleaned.startsWith('+91') && cleaned.length > 13) {
      const lastTen = cleaned.substring(4); // Remove '+91' and get remaining
      if (lastTen.length >= 10) {
        cleaned = '91' + lastTen.slice(-10);
      } else {
        cleaned = '91' + lastTen.padStart(10, '0').slice(-10);
      }
    } else if (cleaned.startsWith('91') && cleaned.length > 12) {
      const lastTen = cleaned.substring(2); // Remove '91' and get remaining
      if (lastTen.length >= 10) {
        cleaned = '91' + lastTen.slice(-10);
      } else {
        cleaned = '91' + lastTen.padStart(10, '0').slice(-10);
      }
    } else if (cleaned.length >= 10) {
      // Extract last 10 digits and add 91 prefix
      const lastTen = cleaned.slice(-10);
      cleaned = '91' + lastTen;
    }
  }

  // Final validation - ensure it's exactly 12 characters (91 + 10 digits)
  if (cleaned.length !== 12 || !cleaned.startsWith('91')) {
    throw new Error('Invalid Indian mobile number format');
  }

  // Validate Indian mobile number pattern (starts with 6, 7, 8, or 9 after country code)
  const mobilePattern = /^91[6-9]\d{9}$/;
  if (!mobilePattern.test(cleaned)) {
    throw new Error('Invalid Indian mobile number format');
  }

  // Return with + prefix for E.164 format
  return '+' + cleaned;
}

/**
 * Validate Indian mobile number format
 * @param {string} mobile - Mobile number to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidIndianMobile(mobile) {
  try {
    normalizeIndianMobile(mobile);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  normalizeIndianMobile,
  isValidIndianMobile
};