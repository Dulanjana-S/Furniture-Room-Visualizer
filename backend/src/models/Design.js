const mongoose = require('mongoose');

const FurnitureItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    rotation: { type: Number, default: 0 },
    color: { type: String, default: '#888888' },
    scale: { type: Number, default: 1 },
    shadow: { type: Boolean, default: false },
    shadowIntensity: { type: Number, default: 0.5 },
    zHeight: { type: Number, default: 0 },
  },
  { _id: false }
);

const RoomSpecSchema = new mongoose.Schema(
  {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    shape: { type: String, enum: ['rectangular', 'square', 'l-shaped'], default: 'rectangular' },
    // For L-shaped rooms: notch removed from TOP-RIGHT corner (meters)
    notchWidth: { type: Number, default: 2 },
    notchHeight: { type: Number, default: 2 },
    wallColor: { type: String, default: '#B2BEB5' },
    floorColor: { type: String, default: '#F9FAFB' },
    globalShadow: { type: Boolean, default: false },
    globalShadowIntensity: { type: Number, default: 0.5 },
  },
  { _id: false }
);

const DesignSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    roomSpec: { type: RoomSpecSchema, required: true },
    furniture: { type: [FurnitureItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Design', DesignSchema);
