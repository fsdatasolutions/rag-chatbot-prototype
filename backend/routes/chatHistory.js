const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET /api/chat-history - fetch user's chat history
router.get('/', authenticateToken, async (req, res) => {
    try {
        const messages = await prisma.chatMessage.findMany({
            where: {
                userId: req.user.userId
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (err) {
        console.error('Failed to fetch chat history:', err);
        res.status(500).json({ error: 'Unable to load chat history' });
    }
});

module.exports = router;