// backend/routes/knowledgeBase.js
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET all KBs for current account
router.get('/', authenticateToken, async (req, res) => {
    try {
        const kbs = await prisma.knowledgeBase.findMany({
            where: { accountId: req.user.accountId },
            include: { userAssignments: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(kbs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch knowledge bases' });
    }
});

// POST /api/knowledge-bases
router.post('/', authenticateToken, async (req, res) => {
    const { name, bedrockKnowledgeBaseId, description, department, userIds } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create knowledge bases' });
    }

    try {
        const kb = await prisma.knowledgeBase.create({
            data: {
                name,
                bedrockKnowledgeBaseId,
                description,
                department,
                accountId: req.user.accountId,
                userAssignments: {
                    create: userIds?.map((userId) => ({ userId })) || []
                }
            }
        });
        res.status(201).json(kb);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create knowledge base' });
    }
});

// PUT /api/knowledge-bases/:id
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { description, department, userIds } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update knowledge bases' });
    }

    try {
        // Remove existing user assignments
        await prisma.userKnowledgeBase.deleteMany({ where: { knowledgeBaseId: id } });

        const kb = await prisma.knowledgeBase.update({
            where: { id },
            data: {
                description,
                department,
                userAssignments: {
                    create: userIds?.map((userId) => ({ userId })) || []
                }
            }
        });
        res.json(kb);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update knowledge base' });
    }
});

module.exports = router;
