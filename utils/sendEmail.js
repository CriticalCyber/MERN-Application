// Email utility for admin communications only
// SendGrid is no longer used for customer OTP delivery

const sendEmail = async (options) => {
    // This function is retained for admin email communications only
    // Customer authentication now uses SMS OTP via MSG91
    
    console.log('Admin email would be sent to:', options.email);
    console.log('Subject:', options.subject);
    console.log('Message:', options.message);
    
    // In a real implementation, you would integrate with an email service for admin communications
    // For now, we're logging the email details
    
    return { success: true };
};

module.exports = sendEmail;