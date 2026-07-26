import multer from 'multer';
import path from 'node:path';

// Extension -> source type. Also acts as the allowlist: anything else is rejected.
export const EXT_TO_TYPE = {
  '.pdf': 'pdf',
  '.vtt': 'vtt',
  '.srt': 'vtt',
  '.txt': 'text',
};

export const typeForFile = (name) => EXT_TO_TYPE[path.extname(name).toLowerCase()];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (typeForFile(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error('Only .pdf, .vtt, .srt and .txt files are supported'), { status: 400 }));
  },
});
