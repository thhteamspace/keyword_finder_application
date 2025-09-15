const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'bot', 'system'], required: true },
    content: { type: String, required: true },
    contentType: { type: String, enum: ['news', 'linkedin', null], default: null },
    feedback: {
        isDeclined: { type: Boolean, default: false },
        text: { type: String, default: '' },
        refinedContent: { type: String, default: '' }
    }
}, { timestamps: true });

const ChatSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    messages: [MessageSchema],
    isProcessing: { type: Boolean, default: false }, // Tracks if a chat is active
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);