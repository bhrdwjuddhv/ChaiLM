import { v2 as cloudinary } from 'cloudinary';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} from './constants.js';

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// resource_type 'raw' keeps the file byte-identical and publicly fetchable.
// Cloudinary's 'image' pipeline blocks PDF delivery by default on new accounts.
export function uploadBuffer(buffer, { folder, publicId, format }) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: 'raw', folder, public_id: publicId, format, overwrite: true },
        (err, result) => {
          if (err) {
            // Cloudinary errors carry http_code and a specific message; a bare
            // err.message throws most of that away.
            console.error('[cloudinary] upload failed:', {
              folder,
              publicId,
              format,
              bytes: buffer.length,
              error: err,
            });
            return reject(
              new Error(`Cloudinary upload failed: ${err.message || JSON.stringify(err)}`)
            );
          }
          resolve(result);
        }
      )
      .end(buffer);
  });
}

export const destroyAsset = (publicId) =>
  cloudinary.uploader.destroy(publicId, { resource_type: 'raw', invalidate: true });

export { cloudinary };
