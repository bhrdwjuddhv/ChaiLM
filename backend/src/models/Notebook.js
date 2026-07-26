import mongoose from 'mongoose';

const notebookSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    roadmap: { type: mongoose.Schema.Types.Mixed, default: null },
    podcast: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Notebook', notebookSchema);
