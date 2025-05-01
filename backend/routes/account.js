const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET /api/account
router.get('/', authenticateToken, async (req, res) => {
    try {
        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId },
            include: { knowledgeBases: true }
        });
        res.json(account);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch account info' });
    }
});

module.exports = router;