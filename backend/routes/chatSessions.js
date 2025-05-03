const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET /api/chat-sessions - list all sessions for the current user
router.get('/', authenticateToken, async (req, res) => {
    console.log('➡️ GET /api/chat-sessions for user:', req.user.userId); // <-- Add this

    try {
        const sessions = await prisma.chatSession.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                createdAt: true
            }
        });
        res.json(sessions);
    } catch (err) {
        console.error('Failed to fetch chat sessions:', err);
        res.status(500).json({ error: 'Could not retrieve chat sessions' });
    }
});

// GET /api/chat-sessions/:id - fetch full messages for a session
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const messages = await prisma.chatMessage.findMany({
            where: {
                sessionId: req.params.id,
                userId: req.user.userId
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (err) {
        console.error('Failed to fetch messages for session:', err);
        res.status(500).json({ error: 'Could not retrieve messages' });
    }
});

// POST /api/chat-sessions - create a new session
router.post('/', authenticateToken, async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const session = await prisma.chatSession.create({
            data: {
                title,
                userId: req.user.userId,
                accountId: req.user.accountId
            }
        });
        res.status(201).json(session);
    } catch (err) {
        console.error('Failed to create chat session:', err);
        res.status(500).json({ error: 'Could not create chat session' });
    }
});

module.exports = router;