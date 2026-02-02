exports.adminLogout = (req, res, next) => {
  try {
    if (!req.session) {
      return res.status(200).json({
        success: true,
        message: "Already logged out",
      });
    }

    // 🔴 CRITICAL: Remove admin data
    req.session.adminId = null;

    // 🔴 CRITICAL: Destroy session
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }

      // 🔴 CRITICAL: Clear cookie
      res.clearCookie("connect.sid");

      return res.status(200).json({
        success: true,
        message: "Admin logged out successfully",
      });
    });
  } catch (error) {
    next(error);
  }
};
