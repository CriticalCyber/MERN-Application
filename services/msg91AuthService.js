const axios = require('axios');
const { normalizeIndianMobile } = require('../utils/mobileUtils');

/**
 * Service for handling MSG91 OTP operations
 * Following MSG91 v5 API architecture - backend acts as orchestrator only
 * Backend never generates, stores, or compares OTPs - MSG91 handles all OTP operations
 */
class Msg91AuthService {
  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.senderId = process.env.MSG91_SENDER_ID || 'SHBHVC';
    this.templateId = process.env.MSG91_OTP_TEMPLATE_ID;
    this.baseUrl = 'https://control.msg91.com/api/v5/otp';
    
    if (!this.authKey) {
      throw new Error('MSG91_AUTH_KEY environment variable is required');
    }
    if (!this.templateId) {
      throw new Error('MSG91_OTP_TEMPLATE_ID environment variable is required');
    }
  }

  /**
   * Send OTP to mobile number using MSG91 v5 API
   * @param {string} mobile - Mobile number to send OTP to
   * @returns {Promise<Object>} Response from MSG91 API
   */
  async sendOtp(mobile) {
    try {
      const normalizedMobile = normalizeIndianMobile(mobile);
      
      const payload = {
        template_id: this.templateId,
        mobile: normalizedMobile,
      };
      
      // Add otp_expiry only if it's specifically required by the template
      if (process.env.MSG91_OTP_EXPIRY) {
        payload.otp_expiry = process.env.MSG91_OTP_EXPIRY;
      };

      const response = await axios.post(`${this.baseUrl}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'authkey': this.authKey,
        },
        timeout: 10000, // 10 second timeout
      });

      // Log only success/failure, never the OTP value
      console.log(`MSG91 OTP sent to ${normalizedMobile}: ${response.data.type}`);
      
      return {
        success: response.data.type === 'success',
        message: response.data.message,
        type: response.data.type,
        mobile: normalizedMobile,
      };
    } catch (error) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      
      // Handle specific MSG91 error responses
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || 'Failed to send OTP',
          type: error.response.data.type || 'error',
          error_code: error.response.data.code || 'UNKNOWN_ERROR',
        };
      }
      
      return {
        success: false,
        message: 'Network error occurred while sending OTP',
        type: 'error',
        error_code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Verify OTP using MSG91 v5 API
   * @param {string} mobile - Mobile number that received OTP
   * @param {string} otp - OTP to verify
   * @returns {Promise<Object>} Response from MSG91 API
   */
  async verifyOtp(mobile, otp) {
    try {
      const normalizedMobile = normalizeIndianMobile(mobile);

      const payload = {
        template_id: this.templateId,
        mobile: normalizedMobile,
        otp: otp,
      };

      const response = await axios.post(`${this.baseUrl}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'authkey': this.authKey,
        },
        timeout: 10000, // 10 second timeout
      });

      // Log only success/failure, never the OTP value
      console.log(`MSG91 OTP verification for ${normalizedMobile}: ${response.data.type}`);
      
      return {
        success: response.data.type === 'success',
        message: response.data.message,
        type: response.data.type,
        mobile: normalizedMobile,
        ...(response.data?.jwt && { jwt: response.data.jwt }), // Include JWT if provided by MSG91
      };
    } catch (error) {
      console.error('Error verifying OTP:', error.response?.data || error.message);
      
      // Handle specific MSG91 error responses
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || 'Failed to verify OTP',
          type: error.response.data.type || 'error',
          error_code: error.response.data.code || 'UNKNOWN_ERROR',
        };
      }
      
      return {
        success: false,
        message: 'Network error occurred while verifying OTP',
        type: 'error',
        error_code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Normalize Indian mobile number to E.164 format
   * @param {string} mobile - Raw mobile number
   * @returns {string} Normalized mobile number in E.164 format
   */
  normalizeIndianMobile(mobile) {
    return normalizeIndianMobile(mobile);
  }
}

module.exports = new Msg91AuthService();