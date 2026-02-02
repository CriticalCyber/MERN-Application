const multer = require("multer");

// Create directories if they don't exist
const fs = require('fs');
const path = require('path');

// Allowed image file types
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Ensure upload directories exist
ensureDirExists(path.join(__dirname, '../..', 'uploads'));
ensureDirExists(path.join(__dirname, '../..', 'uploads/products'));
ensureDirExists(path.join(__dirname, '../..', 'uploads/categories'));

const fileFilter = (req, file, cb) => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WEBP files are allowed.'), false);
  }
  
  // Multer handles file size validation via limits.fileSize
  // The content-length check was incorrectly validating the entire multipart request size
  // instead of the individual file size, so we remove that check
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on route or request
    let destFolder = 'uploads';
    
    // Check if it's a product or category upload based on URL
    if (req.originalUrl && req.originalUrl.includes('product')) {
      destFolder = 'uploads/products';
    } else if (req.originalUrl && req.originalUrl.includes('category')) {
      destFolder = 'uploads/categories';
    }
    
    const fullPath = path.join(__dirname, '../..', destFolder);
    ensureDirExists(fullPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Export the raw multer instance for routes that define their own fields
module.exports = upload;

