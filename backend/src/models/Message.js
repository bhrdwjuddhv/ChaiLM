import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema(
  {
    id: String, // matches the [n] marker in content
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Source' },
    sourceType: String,
    title: String,
    snippet: String,
    position: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notebook', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    citations: { type: [citationSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
