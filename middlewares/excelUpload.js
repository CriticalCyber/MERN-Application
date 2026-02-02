const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const ErrorHandler = require('../utils/errorHandler');

// Multer storage configuration for Excel files
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

// File filter for Excel files only
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'application/vnd.ms-excel.template.macroEnabled.12'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xls') || file.originalname.endsWith('.xlsx')) {
        cb(null, true);
    } else {
        cb(new ErrorHandler('Only Excel files (.xls, .xlsx) are allowed!', 400), false);
    }
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for Excel files
    }
});

// Middleware to parse Excel file
const parseExcel = (req, res, next) => {
    if (!req.file) {
        return next(new ErrorHandler('No file uploaded', 400));
    }

    const filePath = req.file.path;

    try {
        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const results = xlsx.utils.sheet_to_json(worksheet);
        
        // Remove the temporary file
        fs.unlinkSync(filePath);
        
        // Attach parsed data to request object
        req.excelData = results;
        next();
    } catch (error) {
        // Remove the temporary file in case of error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        next(new ErrorHandler('Error parsing Excel file: ' + error.message, 500));
    }
};

module.exports = {
    upload,
    parseExcel
};