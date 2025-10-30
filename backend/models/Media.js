import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: false, trim: true },
  tags: [{ type: String, trim: true }],
  image: {
    url: { type: String, required: true },
    filename: { type: String, trim: true },
    size: { type: Number },
    mimeType: { type: String }
  },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  linked_to_id: { type: mongoose.Schema.Types.ObjectId, refPath: 'linked_to_model', required: false, default: null },
  linked_to_model: { type: String, required: false, enum: [null, 'Event', 'News'], default: null },
  uploaded_date: { type: Date, default: Date.now }
}, { timestamps: true });

mediaSchema.index({ title: 1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ uploaded_by: 1 });
mediaSchema.index({ linked_to_id: 1 });
mediaSchema.index({ uploaded_date: -1 });
mediaSchema.index({ 'tags': 1, 'uploaded_date': -1 });

const Media = mongoose.model('Media', mediaSchema);
export default Media;

