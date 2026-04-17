const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// List my accepted friends + pending in/out.
router.get('/', async (req, res) => {
    try {
        const me = new mongoose.Types.ObjectId(req.user.id);
        const rows = await Friendship.find({
            $or: [{ requester: me }, { recipient: me }]
        }).populate('requester recipient', 'displayName username avatarUrl');

        const shape = (f) => {
            const isRequester = String(f.requester._id) === req.user.id;
            const other = isRequester ? f.recipient : f.requester;
            return {
                id: f._id,
                status: f.status,
                direction: isRequester ? 'outgoing' : 'incoming',
                user: {
                    id: other._id,
                    displayName: other.displayName,
                    username: other.username,
                    avatarUrl: other.avatarUrl
                },
                createdAt: f.createdAt,
                acceptedAt: f.acceptedAt
            };
        };
        res.json({ success: true, data: rows.map(shape) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Send friend request.
router.post('/', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid userId' });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ success: false, error: 'Cannot friend yourself' });
        }
        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ success: false, error: 'User not found' });

        const existing = await Friendship.findBetween(req.user.id, userId);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Friendship already exists', data: { status: existing.status } });
        }

        const f = await Friendship.create({
            requester: req.user.id,
            recipient: userId,
            status: 'pending'
        });
        res.status(201).json({ success: true, data: f });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Accept / decline a pending request.
router.patch('/:id', async (req, res) => {
    try {
        const { action } = req.body; // 'accept' | 'decline' | 'block'
        const f = await Friendship.findById(req.params.id);
        if (!f) return res.status(404).json({ success: false, error: 'Request not found' });

        if (action === 'accept' || action === 'decline') {
            if (String(f.recipient) !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Only recipient can respond' });
            }
            if (action === 'accept') {
                f.status = 'accepted';
                f.acceptedAt = new Date();
                await f.save();
                return res.json({ success: true, data: f });
            }
            await f.deleteOne();
            return res.json({ success: true, data: { id: req.params.id, status: 'declined' } });
        }

        if (action === 'block') {
            if (String(f.requester) !== req.user.id && String(f.recipient) !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Not your friendship' });
            }
            f.status = 'blocked';
            await f.save();
            return res.json({ success: true, data: f });
        }

        res.status(400).json({ success: false, error: 'Invalid action' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Remove/unfriend.
router.delete('/:id', async (req, res) => {
    try {
        const f = await Friendship.findById(req.params.id);
        if (!f) return res.status(404).json({ success: false, error: 'Not found' });
        if (String(f.requester) !== req.user.id && String(f.recipient) !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not your friendship' });
        }
        await f.deleteOne();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
