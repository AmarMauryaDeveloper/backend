import multer from 'multer';
import path from 'path';

// Memory storage configuration
const storage = multer.memoryStorage();

// File validation filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed formats: PDF, DOCX, XLSX, PNG, JPG.'), false);
  }
};

// Initialize multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});


// Wrap multer array to handle validation and file limit errors
export const uploadAttachments = (req, res, next) => {
  const uploader = upload.array('attachments', 3);

  uploader(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Maximum of 3 files allowed for upload.',
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

export const uploadAvatar = (req, res, next) => {
  const uploader = upload.single('avatar');

  uploader(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

