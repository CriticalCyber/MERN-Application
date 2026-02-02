const axios = require('axios');

/**
 * Service for sending SMS via MSG91 DLT Flow templates
 * This service handles direct SMS sending without any notification abstraction layers
 * All SMS operations are fire-and-forget to ensure order creation is never blocked
 */

/**
 * Send SMS using MSG91 DLT Flow template
 * @param {Object} options - SMS options
 * @param {string} options.mobile - Mobile number (10 digits, with or without +91 prefix)
 * @param {string} options.templateId - MSG91 DLT Flow template ID
 * @param {Object} options.variables - Template variables object
 * @returns {Promise<void>} - Always resolves, errors are logged only
 */
async function sendMSG91SMS({ mobile, templateId, variables = {} }) {
    try {
        // Validate required parameters
        if (!mobile || !templateId) {
            console.warn('MSG91 SMS: Missing required parameters (mobile or templateId)');
            return;
        }

        // Strip +91 or 91 prefix if present, keep only last 10 digits
        mobile = mobile.replace(/^\+?91/, '');

        // Validate Indian mobile number (10 digits)
        if (!/^[6-9]\d{9}$/.test(mobile)) {
            console.warn(`MSG91 SMS: Invalid mobile number format: ${mobile}`);
            return;
        }

        // Validate template ID format (alphanumeric)
        if (!/^[a-zA-Z0-9]+$/.test(templateId)) {
            console.warn(`MSG91 SMS: Invalid template ID format: ${templateId}`);
            return;
        }

        // Check environment variables
        const authKey = process.env.MSG91_AUTH_KEY;
        const senderId = process.env.MSG91_SENDER_ID || 'SHBHVC';

        if (!authKey) {
            console.error('MSG91 SMS: MSG91_AUTH_KEY environment variable not set');
            return;
        }

        // Prepare payload for MSG91 Flow API
        const payload = {
            template_id: templateId,
            sender: senderId,
            short_url: '0', // 0 = don't shorten URLs
            mobiles: mobile,
            ...variables
        };

        // Send SMS via MSG91 Flow API
        const response = await axios.post('https://control.msg91.com/api/v5/flow/', payload, {
            headers: {
                'authkey': authKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        // Log success (never log sensitive data)
        if (response.data.type === 'success') {
            console.log(`MSG91 SMS sent successfully to ${mobile} using template ${templateId}`);
        } else {
            console.warn(`MSG91 SMS failed for ${mobile}:`, response.data.message || 'Unknown error');
        }

    } catch (error) {
        // Log error but never throw - this is fire-and-forget
        console.error('MSG91 SMS error (non-blocking):', error.response?.data?.message || error.message);
    }
}

module.exports = {
    sendMSG91SMS
};