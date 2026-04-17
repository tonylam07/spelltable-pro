const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 24,
        match: [/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, or underscores']
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        maxlength: 280,
        default: ''
    },
    favoriteFormats: [{
        type: String,
        enum: ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'pauper', 'draft', 'sealed', 'casual']
    }],
    stats: {
        gamesPlayed: { type: Number, default: 0 },
        gamesWon:    { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toPublicProfile = function () {
    return {
        id: this._id,
        displayName: this.displayName,
        username: this.username,
        avatarUrl: this.avatarUrl,
        bio: this.bio,
        favoriteFormats: this.favoriteFormats,
        stats: this.stats,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', UserSchema);
