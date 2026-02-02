// Email templates for different purposes

// OTP Email Template
const otpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your OTP Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: #2c3e50; margin-bottom: 20px;">ShubhValueCart</h1>
        <h2 style="color: #3498db; margin-bottom: 30px;">Your One-Time Password</h2>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block;">
            <p style="font-size: 18px; margin-bottom: 20px;">Use this OTP to complete your login:</p>
            <div style="font-size: 36px; font-weight: bold; color: #e74c3c; letter-spacing: 5px; padding: 15px; background-color: #f1f2f6; border-radius: 5px; display: inline-block;">
                ${otp}
            </div>
            <p style="margin-top: 25px; font-size: 14px; color: #7f8c8d;">
                This OTP is valid for 5 minutes. If you didn't request this, please ignore this email.
            </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">
            Thank you for choosing ShubhValueCart!<br>
            &copy; 2025 ShubhValueCart. All rights reserved.
        </p>
    </div>
</body>
</html>
`;

// Welcome Email Template
const welcomeEmailTemplate = (userName) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ShubhValueCart</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: #2c3e50; margin-bottom: 20px;">ShubhValueCart</h1>
        <h2 style="color: #27ae60; margin-bottom: 30px;">Welcome aboard, ${userName}!</h2>
        
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 18px; margin-bottom: 20px;">Thank you for joining ShubhValueCart!</p>
            <p>You can now enjoy shopping with us and take advantage of our exclusive offers.</p>
            
            <div style="margin: 30px 0;">
                <a href="https://www.shubhvaluecart.in" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Start Shopping
                </a>
            </div>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">
            Happy shopping!<br>
            &copy; 2025 ShubhValueCart. All rights reserved.
        </p>
    </div>
</body>
</html>
`;

module.exports = {
    otpEmailTemplate,
    welcomeEmailTemplate
};