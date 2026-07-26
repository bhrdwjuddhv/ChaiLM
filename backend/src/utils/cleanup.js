import { destroyAsset } from '../config/cloudinary.js';

// Uploads store `publicId`; websites also store a separate HTML snapshot.
// A stale Cloudinary asset is cheaper than a delete that fails halfway, so
// failures are logged and the purge continues.
export async function destroySourceAssets(source) {
  const assets = [source.metadata?.publicId, source.metadata?.snapshotPublicId].filter(Boolean);
  for (const publicId of assets) {
    await destroyAsset(publicId).catch((err) =>
      console.error('[cloudinary] destroy failed:', publicId, err.message)
    );
  }
}
