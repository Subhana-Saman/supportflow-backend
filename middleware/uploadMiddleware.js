import multer from 'multer';

// Keep the file in memory (not on disk) so it works the same on serverless
// hosts like Vercel, where local disk writes don't persist between requests.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only images (png, jpg, webp, gif) and PDF files are allowed'));
  }
  cb(null, true);
};

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).single('attachment');

// Wraps multer so its errors come back as our standard JSON error shape
// instead of crashing / leaking a raw multer stack trace.
export const handleUpload = (req, res, next) => {
  uploadAttachment(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
      });
    }
    next();
  });
};