const multer = require("multer");
const path = require('path');
const fs = require('fs');

// Import S3 utilities for conditional upload
const { uploadToS3, isS3Image } = require('../utils/s3Upload');

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

// Create memory uploader for single file uploads
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

// Create a custom storage engine that can handle both S3 and local uploads
const createHybridStorage = (folderType = 'products') => {
  return {
    _handleFile: (req, file, callback) => {
      // Check if S3 uploads are enabled and if this is a product/category route
      const isS3Enabled = process.env.ENABLE_S3_UPLOADS === 'true';
      const isProductRoute = req.originalUrl && req.originalUrl.includes('product');
      const isCategoryRoute = req.originalUrl && req.originalUrl.includes('category');
      const shouldUseS3 = isS3Enabled && (isProductRoute || isCategoryRoute);

      if (shouldUseS3) {
        // Read file buffer and upload to S3
        const chunks = [];
        file.stream.on('data', chunk => chunks.push(chunk));
        
        file.stream.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            // Create a file-like object with buffer for S3 upload
            const fileForS3 = {
              buffer: buffer,
              originalname: file.originalname
            };
            const result = await uploadToS3(fileForS3, folderType);
            
            // For S3 uploads, we store the result in req.s3Files to access later
            if (!req.s3Files) req.s3Files = {};
            if (!req.s3Files[file.fieldname]) req.s3Files[file.fieldname] = [];
            req.s3Files[file.fieldname].push(result);
            
            // Return a mock file object with S3 data
            callback(null, {
              filename: result.public_id,
              path: result.url,
              destination: 's3',
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: buffer.length,
              ...result
            });
          } catch (error) {
            callback(error);
          }
        });
        
        file.stream.on('error', (error) => {
          callback(error);
        });
      } else {
        // Use local storage
        const storage = multer.diskStorage({
          destination: (req, file, cb) => {
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
        
        // Use the local storage to handle the file
        storage._handleFile(req, file, callback);
      }
    },
    
    _removeFile: (req, file, callback) => {
      if (file.destination === 's3') {
        // For S3 files, we don't remove them here, that's handled separately
        callback();
      } else {
        // Use local storage's removeFile method
        const storage = multer.diskStorage({
          destination: (req, file, cb) => {
            let destFolder = 'uploads';
            
            // Check if it's a product or category upload based on URL
            if (req.originalUrl && req.originalUrl.includes('product')) {
              destFolder = 'uploads/products';
            } else if (req.originalUrl && req.originalUrl.includes('category')) {
              destFolder = 'uploads/categories';
            }
            
            const fullPath = path.join(__dirname, '../..', destFolder);
            cb(null, fullPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
          },
        });
        
        storage._removeFile(req, file, callback);
      }
    }
  };
};

// Create multer instances for different use cases
const hybridUpload = (fieldsConfig) => {
  // The folder type will be determined by the createHybridStorage function based on URL
  // Default to 'products' but the actual determination happens in the storage engine
  const defaultFolderType = 'products';
  
  return multer({ 
    storage: createHybridStorage(defaultFolderType),
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE
    }
  }).fields(fieldsConfig);
};

// Create single file upload function for category images
const hybridUploadSingle = (fieldName) => {
  return async (req, res, next) => {
    memoryUpload.single(fieldName)(req, res, async (err) => {
      if (err) return next(err);

      if (!req.file) {
        return next(); // controller will handle missing file
      }

      const isS3Enabled = process.env.ENABLE_S3_UPLOADS === 'true';
      const isProductRoute = req.originalUrl && req.originalUrl.includes('product');
      const isCategoryRoute = req.originalUrl && req.originalUrl.includes('category');
      const shouldUseS3 = isS3Enabled && (isProductRoute || isCategoryRoute);

      if (!shouldUseS3) {
        // Local flow already complete
        return next();
      }

      try {
        const s3Result = await uploadToS3({
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname
        }, req.originalUrl && req.originalUrl.includes('category') ? 'categories' : 'products');

        req.file.location = s3Result.Location;
        req.file.key = s3Result.key;
        req.file.public_id = s3Result.public_id;
        req.file.url = s3Result.url;
        delete req.file.buffer; // cleanup memory
        next();
      } catch (uploadErr) {
        next(uploadErr);
      }
    });
  };
};

// Export different configurations
module.exports = {
  hybridUpload,
  hybridUploadSingle,
  // Standard multer for non-product/category uploads
  standardUpload: multer({ 
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
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
    }),
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE
    }
  })
};