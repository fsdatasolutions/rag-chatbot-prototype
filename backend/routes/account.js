// backend/routes/account.js
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET /api/account - Get the authenticated user's account details
router.get('/', authenticateToken, async (req, res) => {
    try {
        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId },
            include: {
                users: true,
                departments: true,
                knowledgeBases: true
            }
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.status(200).json(account);
    } catch (err) {
        console.error('❌ Failed to fetch account:', err);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

module.exports = router;
