const express = require('express');
const { z } = require('zod');
const { isValidObjectId } = require('mongoose');
const Design = require('../models/Design');
const { authRequired } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

const FurnitureSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  color: z.string(),
  scale: z.number(),
  shadow: z.boolean().optional(),
  shadowIntensity: z.number().optional(),
  zHeight: z.number().optional(),
});

const RoomSpecSchema = z.object({
  width: z.number().min(2).max(50),
  height: z.number().min(2).max(50),
  shape: z.enum(['rectangular', 'square', 'l-shaped']),
  notchWidth: z.number().min(0.5).max(25).optional(),
  notchHeight: z.number().min(0.5).max(25).optional(),
  wallColor: z.string().min(3).max(20),
  floorColor: z.string().min(3).max(20),
  globalShadow: z.boolean().optional(),
  globalShadowIntensity: z.number().min(0).max(1).optional(),
});

const DesignSchema = z.object({
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().default(''),
  roomSpec: RoomSpecSchema,
  furniture: z.array(FurnitureSchema).default([]),
});

router.get('/', asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  const designs = await Design.find({ ownerId }).sort({ updatedAt: -1 });
  res.json({ designs: designs.map(d => ({
    id: d._id.toString(),
    userId: ownerId,
    name: d.name,
    notes: d.notes || '',
    roomSpec: d.roomSpec,
    furniture: d.furniture,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  })) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const parsed = DesignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });

  const ownerId = req.user.userId;
  const design = await Design.create({ ownerId, ...parsed.data });
  res.json({ design: {
    id: design._id.toString(),
    userId: ownerId,
    name: design.name,
    notes: design.notes || '',
    roomSpec: design.roomSpec,
    furniture: design.furniture,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
  }});
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid design id' });
  const design = await Design.findOne({ _id: req.params.id, ownerId });
  if (!design) return res.status(404).json({ error: 'Not found' });
  res.json({ design: {
    id: design._id.toString(),
    userId: ownerId,
    name: design.name,
    notes: design.notes || '',
    roomSpec: design.roomSpec,
    furniture: design.furniture,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
  }});
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = DesignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });

  const ownerId = req.user.userId;
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid design id' });
  const updated = await Design.findOneAndUpdate(
    { _id: req.params.id, ownerId },
    { $set: parsed.data },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ design: {
    id: updated._id.toString(),
    userId: ownerId,
    name: updated.name,
    notes: updated.notes || '',
    roomSpec: updated.roomSpec,
    furniture: updated.furniture,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }});
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid design id' });
  const deleted = await Design.findOneAndDelete({ _id: req.params.id, ownerId });
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

module.exports = router;
