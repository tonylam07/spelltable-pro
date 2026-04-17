const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, data: user.toPublicProfile() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.patch('/me', authenticate, async (req, res) => {
    try {
        const allowed = ['displayName', 'username', 'avatarUrl', 'bio', 'favoriteFormats'];
        const patch = {};
        for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

        const user = await User.findByIdAndUpdate(req.user.id, patch, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, data: user.toPublicProfile() });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, error: 'Username taken' });
        res.status(400).json({ success: false, error: err.message });
    }
});

router.get('/search', authenticate, async (req, res) => {
    try {
        const q = (req.query.q || '').trim().toLowerCase();
        if (q.length < 2) return res.json({ success: true, data: [] });

        const users = await User.find({
            _id: { $ne: req.user.id },
            $or: [
                { username: { $regex: `^${q}`, $options: 'i' } },
                { displayName: { $regex: q, $options: 'i' } }
            ]
        }).limit(20);
        res.json({ success: true, data: users.map(u => u.toPublicProfile()) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid user id' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, data: user.toPublicProfile() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
