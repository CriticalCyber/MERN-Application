const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create thumbnails directory if it doesn't exist
const ensureThumbnailsDirExists = () => {
    const thumbnailsDir = path.join(__dirname, '../..', 'uploads/thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
};

// Process image and create thumbnail
const processImage = async (imagePath, fileName) => {
    try {
        // Ensure thumbnails directory exists
        ensureThumbnailsDirExists();
        
        // Define thumbnail path
        const thumbnailPath = path.join(__dirname, '../..', 'uploads/thumbnails', fileName);
        
        // Create thumbnail (200x200 pixels)
        await sharp(imagePath)
            .resize(200, 200, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
            
        return {
            original: imagePath,
            thumbnail: thumbnailPath
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Failed to process image');
    }
};

// Delete image files
const deleteImageFiles = (imagePaths) => {
    imagePaths.forEach(imagePath => {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    });
};

module.exports = {
    processImage,
    deleteImageFiles
};