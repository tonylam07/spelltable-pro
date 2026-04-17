const mongoose = require('mongoose');

const FriendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        default: 'pending',
        index: true
    },
    acceptedAt: { type: Date }
}, {
    timestamps: true
});

FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

FriendshipSchema.statics.findBetween = function (a, b) {
    return this.findOne({
        $or: [
            { requester: a, recipient: b },
            { requester: b, recipient: a }
        ]
    });
};

module.exports = mongoose.model('Friendship', FriendshipSchema);
