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
            include: {
                department: true,
                userAssignments: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(JSON.stringify(kbs, null, 2));

        res.json(kbs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch knowledge bases' });
    }
});

// GET /api/knowledge-bases/user-accessible
router.get('/user-accessible', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: {
                department: true,
                kbAssignments: {
                    include: { knowledgeBase: true }
                }
            }
        });

        const departmentId = user.departmentId;

        const departmentKbs = await prisma.knowledgeBase.findMany({
            where: {
                accountId: req.user.accountId,
                OR: [
                    { departmentId },
                    {
                        userAssignments: {
                            some: { userId: req.user.userId }
                        }
                    }
                ]
            }
        });

        res.json(departmentKbs);
    } catch (err) {
        console.error('Failed to fetch accessible KBs:', err);
        res.status(500).json({ error: 'Failed to load accessible knowledge bases' });
    }
});


// POST /api/knowledge-bases
router.post('/', authenticateToken, async (req, res) => {
    const { name, description, bedrockKnowledgeBaseId, userIds, departmentId } = req.body;

    try {
        const kb = await prisma.knowledgeBase.create({
            data: {
                name,
                description,
                bedrockKnowledgeBaseId,
                accountId: req.user.accountId,
                departmentId: departmentId || null,
                userAssignments: {
                    create: userIds?.map((userId) => ({
                        user: { connect: { id: userId } }
                    })) || []
                }
            },
            include: {
                department: true,
                userAssignments: { include: { user: true } }
            }
        });

        res.status(201).json(kb);
    } catch (err) {
        console.error('Error creating knowledge base:', err);
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
