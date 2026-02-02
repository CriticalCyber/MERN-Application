const Admin = require('../../../models/adminModel');
const logger = require('../../../utils/logger');

// Admin Login Controller
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find admin in admin collection
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Compare password
    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({
          success: false,
          message: "Login failed. Please try again."
        });
      }

      // Store admin identity in session
      req.session.adminId = admin._id.toString();

      // Save the session
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
          });
        }

        // Log successful admin login
        logger.info(`Admin logged in successfully: ${admin._id}`);

        res.status(200).json({
          success: true,
          message: "Admin logged in successfully",
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email
          }
        });
      });
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again."
    });
  }
};
