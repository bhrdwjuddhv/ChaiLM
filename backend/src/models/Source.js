import mongoose from 'mongoose';

export const SOURCE_TYPES = ['pdf', 'website', 'text', 'youtube', 'playlist', 'vtt'];
export const SOURCE_STATUSES = ['pending', 'processing', 'indexed', 'failed'];

const sourceSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notebook', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: SOURCE_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    storageUrl: String,
    sourceUrl: String,
    status: { type: String, enum: SOURCE_STATUSES, default: 'pending' },
    progress: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: String,
  },
  { timestamps: true }
);

export default mongoose.model('Source', sourceSchema);
