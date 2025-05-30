// backend/routes/knowledgeBase.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../db/prisma');
const { v4: uuidv4 } = require('uuid');
const { uploadToObjectStore } = require('../utils/rag/kbStorage');
const extractTextFromBuffer = require('../utils/rag/extractTextFromBuffer');
const chunkAndEmbedFile = require('../utils/rag/chunkAndEmbedFile');
const authenticateToken = require('../middleware/auth');
const { getStorageClient } = require('../utils/storageClient');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/knowledge-bases
router.get('/', authenticateToken, async (req, res) => {
    try {
        const kbs = await prisma.knowledgeBase.findMany({
            where: { accountId: req.user.accountId },
            include: {
                department: true,
                userAssignments: { include: { user: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(kbs);
    } catch (err) {
        console.error('❌ Failed to fetch KBs:', err);
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
                kbAssignments: { include: { knowledgeBase: true } },
            },
        });

        const departmentId = user.departmentId;

        const departmentKbs = await prisma.knowledgeBase.findMany({
            where: {
                accountId: req.user.accountId,
                OR: [
                    { departmentId },
                    {
                        userAssignments: {
                            some: { userId: req.user.userId },
                        },
                    },
                ],
            },
        });

        res.json(departmentKbs);
    } catch (err) {
        console.error('❌ Failed to fetch user KBs:', err);
        res.status(500).json({ error: 'Failed to fetch accessible knowledge bases' });
    }
});

// POST /api/knowledge-bases
router.post('/', authenticateToken, async (req, res) => {
    const { name, description, departmentId } = req.body;

    if (!name) return res.status(400).json({ error: 'Knowledge base name is required' });

    try {
        const externalKbId = `kb-${uuidv4()}`;
        const kb = await prisma.knowledgeBase.create({
            data: {
                name,
                description,
                departmentId: departmentId || null,
                accountId: req.user.accountId,
                externalKbId,
            },
        });
        res.status(201).json(kb);
    } catch (err) {
        console.error('❌ Failed to create KB:', err);
        res.status(500).json({ error: 'Failed to create knowledge base' });
    }
});

// POST /api/knowledge-bases/:id/documents
router.post('/:id/documents', authenticateToken, upload.single('file'), async (req, res) => {
    const { id: knowledgeBaseId } = req.params;
    const { buffer, originalname } = req.file;

    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
        const account = await prisma.account.findUnique({ where: { id: req.user.accountId } });

        if (!kb || !account || !account.storageBucket) {
            return res.status(400).json({ error: 'Invalid KB or account setup' });
        }

        const { s3Key } = await uploadToObjectStore({
            accountId: req.user.accountId,
            kbName: kb.name,
            fileName: originalname,
            content: buffer,
            bucket: account.storageBucket,
        });

        await chunkAndEmbedFile({
            buffer,
            fileName: originalname,
            knowledgeBaseId: kb.id,
            embeddingModel: kb.embeddingModel || 'text-embedding-ada-002',
            sourcePrefix: s3Key,
        });

        res.json({ message: 'Document uploaded and processed successfully.' });
    } catch (err) {
        console.error('❌ Failed to process file:', err);
        res.status(500).json({ error: 'Failed to process and ingest document' });
    }
});

// GET /api/knowledge-bases/:id/files
router.get('/:id/files', authenticateToken, async (req, res) => {
    const { id: knowledgeBaseId } = req.params;

    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
        const account = await prisma.account.findUnique({ where: { id: req.user.accountId } });

        if (!kb || !account || !account.storageBucket) {
            return res.status(400).json({ error: 'Invalid KB or account setup' });
        }

        const storage = getStorageClient();
        const prefix = `${req.user.accountId}/${kb.name}/uploads/`;
        const listCommand = {
            Bucket: account.storageBucket,
            Prefix: prefix,
        };

        const { Contents = [] } = await storage.send(new (require('@aws-sdk/client-s3').ListObjectsV2Command)(listCommand));

        const files = Contents.map(obj => ({
            key: obj.Key,
            name: obj.Key.split('/').pop().replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, ''),
            uploadTime: obj.LastModified,
            size: obj.Size
        }));

        res.status(200).json({ files });
    } catch (err) {
        console.error('❌ Failed to fetch KB documents:', err);
        res.status(500).json({ error: 'Failed to fetch knowledge base documents' });
    }
});

module.exports = router;
