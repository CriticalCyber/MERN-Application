const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');

/**
 * Sanitize input to prevent XSS attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove HTML tags and limit length
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Limit length to 1000 characters
    if (sanitized.length > 1000) {
        sanitized = sanitized.substring(0, 1000);
    }
    
    return sanitized;
};

/**
 * Sanitize query parameters to prevent NoSQL injection
 * @param {object} query - Query object to sanitize
 * @returns {object} Sanitized query object
 */
const sanitizeQuery = (query) => {
    // Use express-mongo-sanitize to remove malicious keys
    const sanitizedQuery = mongoSanitize.sanitize(query, { replaceWith: '_' });
    
    // Additionally sanitize string values
    for (const key in sanitizedQuery) {
        if (typeof sanitizedQuery[key] === 'string') {
            sanitizedQuery[key] = sanitizeInput(sanitizedQuery[key]);
        }
    }
    
    return sanitizedQuery;
};

/**
 * Sanitize database queries to prevent injection
 * @param {any} value - Value to sanitize for database queries
 * @returns {any} Sanitized value
 */
const sanitizeDbQuery = (value) => {
    // For string values, use $eq operator to prevent injection
    if (typeof value === 'string') {
        return { $eq: sanitizeInput(value) };
    }
    
    // For objects, recursively sanitize
    if (typeof value === 'object' && value !== null) {
        const sanitized = {};
        for (const key in value) {
            sanitized[key] = sanitizeDbQuery(value[key]);
        }
        return sanitized;
    }
    
    // For other types, return as is
    return value;
};

module.exports = {
    sanitizeInput,
    sanitizeQuery,
    sanitizeDbQuery
};