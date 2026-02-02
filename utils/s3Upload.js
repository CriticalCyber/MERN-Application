const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require("fs");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadToS3 = async (file, folder = "products") => {
  if (!file) {
    throw new Error("Invalid file: file object is missing");
  }

  // Handle both file with path (local storage) and file with buffer (from hybrid upload)
  let fileBuffer;
  if (file.path) {
    // File has path - read from disk (local storage case)
    fileBuffer = fs.readFileSync(file.path);
  } else if (file.buffer) {
    // File has buffer - use directly (hybrid upload case)
    fileBuffer = file.buffer;
  } else {
    throw new Error("Invalid file: neither path nor buffer available");
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `${folder}/${Date.now()}-${file.originalname}`,
    Body: fileBuffer,
    ContentType: file.mimetype,
  };

  const upload = new Upload({
    client: s3Client,
    params: params,
  });

  const result = await upload.done();

  return {
    key: result.Key,
    public_id: result.Key, // For backward compatibility
    url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${result.Key}`,
  };
};

// Delete from S3
const deleteFromS3 = async (keyOrPublicId) => {
  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: keyOrPublicId,
  };

  await s3Client.send(new DeleteObjectCommand(params));
};

// Check if image is from S3
const isS3Image = (url) => {
  return url && process.env.AWS_S3_BUCKET_NAME && url.includes(process.env.AWS_S3_BUCKET_NAME);
};

// Check if image is from local storage
const isLocalImage = (url) => {
  return !isS3Image(url);
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  isS3Image,
  isLocalImage,
};