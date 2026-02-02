// DISABLED: Notification service completely disabled for direct MSG91 DLT Flow implementation
// This service returns empty object to prevent any notification execution

module.exports = {};
return;

/* DISABLED CODE - RETAINED FOR REFERENCE ONLY
const sendEmail = require('../utils/sendEmail');
// We'll implement SMS service using Twilio
const twilio = require('twilio');
// Import notification template model
const NotificationTemplate = require('../models/notificationTemplateModel');

class NotificationService {
    constructor() {
        // Initialize Twilio client if credentials are available
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        }
        
        // Store of user notification preferences
        this.userPreferences = new Map();
    }

*/

// All notification service functionality has been disabled
// No email, SMS, push, or templated notifications will execute