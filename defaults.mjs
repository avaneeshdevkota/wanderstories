import path from 'path'
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from "fs";
import multer from 'multer';

export const DIRNAME = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_DIRECTORY = './public/uploads'; // Specify the destination directory
export const STORAGE_PATH = path.join(DIRNAME, STORAGE_DIRECTORY); // Create the absolute path

if (!existsSync(STORAGE_PATH)) {
    mkdirSync(STORAGE_PATH, { recursive: true }); // Create the directory recursively
}

export const STORAGE = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, STORAGE_DIRECTORY);
    },
    filename: (req, file, cb) => {
      const extArray = file.mimetype.split('/');
      const extension = extArray[extArray.length - 1];
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.originalname.split('.')[0] + '-' + uniqueSuffix + '.' + extension);
    },
  });
  
export const UPLOAD = multer({ storage: STORAGE });
export const SERVE_FROM = 'public';