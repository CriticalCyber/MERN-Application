const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const ErrorHandler = require('../utils/errorHandler');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create temp directory if it doesn't exist
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// File filter for CSV files only
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
    cb(null, true);
  } else {
    cb(new ErrorHandler('Only CSV files are allowed!', 400), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware to parse CSV file
const parseCSV = (req, res, next) => {
  if (!req.file) {
    return next(new ErrorHandler('No file uploaded', 400));
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Remove the temporary file
      fs.unlinkSync(filePath);
      
      // Attach parsed data to request object
      req.csvData = results;
      next();
    })
    .on('error', (error) => {
      // Remove the temporary file in case of error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      next(new ErrorHandler('Error parsing CSV file', 500));
    });
};

module.exports = {
  upload,
  parseCSV
};