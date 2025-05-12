// backend/routes/knowledgeBase.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // parses multipart/form-data and stores in memory

const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');
const uploadKnowledgeBaseFiles = require('../aws/uploadKnowledgeBaseFiles');
const { createKnowledgeBase } = require('../aws/knowledgeBaseManager');

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
router.post('/', authenticateToken, upload.array('files'), async (req, res) => {

    const { name, description, bedrockKnowledgeBaseId, departmentId } = req.body;
    const { accountId } = req.user;
    try {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });
        if (!account || !account.s3Bucket) {
            return res.status(400).json({ error: 'Account or S3 bucket not found' });
        }

        //  Upload files to tenant's bucket under `kb/{kbName}/`
        if (req.files && req.files.length > 0) {
            await uploadKnowledgeBaseFiles({
                bucket: account.s3Bucket,
                kbName: name,
                files: req.files,
                tenantId: accountId,
                environment: process.env.NODE_ENV || 'prod',
            });
        }

        // 2️Create Knowledge Base record
        const kbData = {
            name,
            description,
            accountId
        };


        const { bedrockKnowledgeBaseId } = await createKnowledgeBase({
            accountId,
            kbName: name,
            files: req.files
        });
        console.log('bedrockKnowledgeBaseId',bedrockKnowledgeBaseId);

        if (bedrockKnowledgeBaseId) kbData.bedrockKnowledgeBaseId = bedrockKnowledgeBaseId;
        if (departmentId) kbData.departmentId = departmentId;



        const kb = await prisma.knowledgeBase.create({ data: kbData });

        res.status(201).json(kb);
    } catch (err) {
        console.error('Failed to create KB:', err);
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


router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
    const { name, description } = req.body;
    const files = req.files;
    const { userId, accountId } = req.user;

    if (!name || files.length === 0) {
        return res.status(400).json({ error: 'KB name and at least one file are required' });
    }

    try {
        // 1. Retrieve the tenant's account and S3 bucket
        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account?.s3Bucket) {
            return res.status(500).json({ error: 'Account missing S3 bucket configuration' });
        }

        // 2. Create KB record in DB
        const kb = await prisma.knowledgeBase.create({
            data: {
                accountId,
                name,
                description: description || null
            }
        });

        // 3. Upload files to S3
        await uploadKnowledgeBaseFiles({
            bucket: account.s3Bucket,
            kbName: name,
            tenantId: `tenant-${accountId}`,
            files
        });

        res.status(201).json({ message: 'Knowledge Base created successfully', kb });
    } catch (err) {
        console.error('Failed to create knowledge base:', err);
        res.status(500).json({ error: 'KB creation failed' });
    }
});

module.exports = router;
