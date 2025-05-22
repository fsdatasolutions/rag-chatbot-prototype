// backend/routes/knowledgeBase.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // parses multipart/form-data and stores in memory

const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');
const {
    createKnowledgeBase,
    uploadKnowledgeBaseDocument,
    getKnowledgeBase,
    deleteKnowledgeBase,
    listIngestionJobs
} = require('../aws/knowledgeBaseManager');

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

        res.json(kbs);
    } catch (err) {
        console.error('Failed to fetch knowledge bases:', err);
        res.status(500).json({ error: 'Failed to fetch knowledge bases' });
    }
});

// GET all Bedrock KBs from AWS — Admin-only
router.get('/all-bedrock', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const client = new BedrockAgentClient({ region: process.env.AWS_REGION });
        const command = new ListKnowledgeBasesCommand({});
        const response = await client.send(command);

        res.json(response.knowledgeBaseSummaries);
    } catch (err) {
        console.error('Failed to fetch AWS KBs:', err);
        res.status(500).json({ error: 'Failed to fetch AWS knowledge bases' });
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

// GET /api/knowledge-bases/:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Get KB from database
        const kb = await prisma.knowledgeBase.findUnique({
            where: {
                id,
                accountId: req.user.accountId // Ensure user can only access KBs from their account
            },
            include: {
                department: true,
                userAssignments: {
                    include: { user: true }
                }
            }
        });

        if (!kb) {
            return res.status(404).json({ error: 'Knowledge base not found' });
        }

        // Get additional details from Bedrock if available
        let bedrockDetails = null;
        if (kb.bedrockKnowledgeBaseId) {
            try {
                bedrockDetails = await getKnowledgeBase(kb.bedrockKnowledgeBaseId);
            } catch (bedrockErr) {
                console.error('Error fetching Bedrock KB details:', bedrockErr);
                // Continue without Bedrock details
            }
        }

        res.json({
            ...kb,
            bedrockDetails
        });
    } catch (err) {
        console.error('Failed to fetch knowledge base:', err);
        res.status(500).json({ error: 'Failed to fetch knowledge base details' });
    }
});

// POST /api/knowledge-bases
router.post('/', authenticateToken, upload.array('files'), async (req, res) => {
    const { name, description, departmentId, embeddingModelArn } = req.body;
    const { accountId } = req.user;

    if (!name) {
        return res.status(400).json({ error: 'Knowledge base name is required' });
    }

    try {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account || !account.s3Bucket || !account.vectorStoreArn) {
            return res.status(400).json({ error: 'Account not properly configured for knowledge bases' });
        }

        // Create Bedrock knowledge base with data source for uploaded files
        const {
            bedrockKnowledgeBaseId,
            dataSourceId
        } = await createKnowledgeBase({
            accountId,
            kbName: name,
            files: req.files,
            departmentId,
            embeddingModelArn
        });

        // Create KB record in database
        const kb = await prisma.knowledgeBase.create({
            data: {
                name,
                description: description || `Knowledge base: ${name}`,
                accountId,
                bedrockKnowledgeBaseId,
                departmentId: departmentId || null,
                embeddingModel: req.body.embeddingModel || null,
                s3Prefix: req.body.s3Prefix || null,
                vectorIndexName: req.body.vectorIndexName || null,
                userAssignments: req.body.userIds ? {
                    create: req.body.userIds.map((userId) => ({ userId }))
                } : undefined
            }
        });

        // Process uploaded files if any
        if (req.files && req.files.length > 0) {
            // Upload files one by one to S3 in the KB-specific folder
            for (const file of req.files) {
                await uploadKnowledgeBaseDocument({
                    bucketName: account.s3Bucket,
                    kbName: name,
                    fileName: file.originalname,
                    content: file.buffer,
                    knowledgeBaseId: bedrockKnowledgeBaseId,
                    dataSourceId,
                    tenantId: `tenant-${accountId}`
                });
            }

            // No need to start ingestion job here since createKnowledgeBase already did that
        }

        res.status(201).json({
            ...kb,
            fileCount: req.files ? req.files.length : 0,
            dataSourceId
        });
    } catch (err) {
        console.error('Failed to create KB:', err);
        res.status(500).json({ error: 'Failed to create knowledge base: ' + err.message });
    }
});

// PUT /api/knowledge-bases/:id
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { description, departmentId, userIds } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update knowledge bases' });
    }

    try {
        // First, verify this KB belongs to the user's account
        const existingKb = await prisma.knowledgeBase.findUnique({
            where: { id },
            select: { accountId: true }
        });

        if (!existingKb || existingKb.accountId !== req.user.accountId) {
            return res.status(404).json({ error: 'Knowledge base not found' });
        }

        // Remove existing user assignments if userIds is provided
        if (userIds) {
            await prisma.userKnowledgeBase.deleteMany({
                where: { knowledgeBaseId: id }
            });
        }

        // Update the knowledge base
        const kb = await prisma.knowledgeBase.update({
            where: { id },
            data: {
                description: description || undefined,
                departmentId: departmentId || undefined,
                embeddingModel: req.body.embeddingModel || undefined,
                s3Prefix: req.body.s3Prefix || undefined,
                vectorIndexName: req.body.vectorIndexName || undefined,
                userAssignments: userIds ? {
                    create: userIds.map((userId) => ({ userId }))
                } : undefined
            }
        });

        res.json(kb);
    } catch (err) {
        console.error('Failed to update knowledge base:', err);
        res.status(500).json({ error: 'Failed to update knowledge base' });
    }
});

// DELETE /api/knowledge-bases/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete knowledge bases' });
    }

    try {
        // First, verify this KB belongs to the user's account
        const existingKb = await prisma.knowledgeBase.findUnique({
            where: { id },
            select: { accountId: true, bedrockKnowledgeBaseId: true }
        });

        if (!existingKb || existingKb.accountId !== req.user.accountId) {
            return res.status(404).json({ error: 'Knowledge base not found' });
        }

        // Delete from Bedrock if applicable
        if (existingKb.bedrockKnowledgeBaseId) {
            try {
                await deleteKnowledgeBase(existingKb.bedrockKnowledgeBaseId);
            } catch (bedrockErr) {
                console.error(`Error deleting Bedrock KB ${existingKb.bedrockKnowledgeBaseId}:`, bedrockErr);
                // Continue with database deletion anyway
            }
        }

        // Remove user assignments
        await prisma.userKnowledgeBase.deleteMany({
            where: { knowledgeBaseId: id }
        });

        // Delete KB from database
        await prisma.knowledgeBase.delete({
            where: { id }
        });

        res.json({ message: 'Knowledge base deleted successfully' });
    } catch (err) {
        console.error('Failed to delete knowledge base:', err);
        res.status(500).json({ error: 'Failed to delete knowledge base' });
    }
});

// POST /api/knowledge-bases/:id/documents
router.post('/:id/documents', authenticateToken, upload.array('files'), async (req, res) => {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one file is required' });
    }

    try {
        // First, verify this KB belongs to the user's account and get details
        const kb = await prisma.knowledgeBase.findUnique({
            where: {
                id,
                accountId: req.user.accountId
            }
        });

        if (!kb || !kb.bedrockKnowledgeBaseId) {
            return res.status(404).json({ error: 'Knowledge base not found' });
        }

        // Get the account for S3 bucket information
        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId }
        });

        if (!account || !account.s3Bucket) {
            return res.status(400).json({ error: 'Account not properly configured for file uploads' });
        }

        // Get data source for the knowledge base
        let dataSourceId = req.body.dataSourceId;

        if (!dataSourceId) {
            // Look up data source if not provided
            try {
                const dataSources = await listDataSources(kb.bedrockKnowledgeBaseId);
                if (dataSources && dataSources.length > 0) {
                    dataSourceId = dataSources[0].dataSourceId;
                }
            } catch (dsError) {
                console.error('Error getting data sources:', dsError);
                // Continue without data source ID - files will be uploaded but not ingested
            }
        }

        // Upload files one by one
        const uploadResults = [];
        for (const file of files) {
            const result = await uploadKnowledgeBaseDocument({
                bucketName: account.s3Bucket,
                kbName: kb.name,
                fileName: file.originalname,
                content: file.buffer,
                knowledgeBaseId: kb.bedrockKnowledgeBaseId,
                dataSourceId,
                tenantId: `tenant-${req.user.accountId}`
            });

            uploadResults.push({
                fileName: file.originalname,
                s3Key: result.s3Key,
                ingestionJobId: result.ingestionJobId
            });
        }

        res.json({
            message: `Successfully uploaded ${files.length} files to knowledge base`,
            uploads: uploadResults
        });
    } catch (err) {
        console.error('Failed to upload documents:', err);
        res.status(500).json({ error: 'Failed to upload documents to knowledge base' });
    }
});

// PUT /api/knowledge-bases/link-to-account
router.put('/knowledge-bases/link-to-account', authenticateToken, async (req, res) => {
    const { knowledgeBaseId } = req.body;
    const accountId = req.user.accountId;

    try {
        const bedrockClient = new BedrockAgentClient({ region: process.env.AWS_REGION });
        const list = await bedrockClient.send(new ListKnowledgeBasesCommand({}));
        const awsKB = list.knowledgeBaseSummaries.find(kb => kb.knowledgeBaseId === knowledgeBaseId);

        if (!awsKB) return res.status(404).json({ error: 'AWS KB not found' });

        const existing = await prisma.knowledgeBase.findFirst({
            where: {
                bedrockKnowledgeBaseId: knowledgeBaseId,
                accountId
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'KB already linked to this account' });
        }

        await prisma.knowledgeBase.create({
            data: {
                name: awsKB.name,
                description: awsKB.description || '',
                bedrockKnowledgeBaseId: knowledgeBaseId,
                accountId
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Linking KB failed:', err);
        res.status(500).json({ error: 'Failed to link knowledge base' });
    }
});

// GET /api/aws-bedrock/knowledge-bases — Fetch AWS KBs for tenant that aren't in DB
router.get('/aws-bedrock/knowledge-bases', authenticateToken, async (req, res) => {
    const accountId = req.user.accountId;
    console.log('accountId:', accountId);

    try {
        const bedrockClient = new BedrockAgentClient({ region: process.env.AWS_REGION });
        const result = await bedrockClient.send(new ListKnowledgeBasesCommand({}));
        const awsKBs = result.knowledgeBaseSummaries;

        const matchingKBs = awsKBs.filter(kb =>
            kb.name.includes(accountId) || (kb.tags || []).some(tag => tag.value === accountId)
        );

        const existing = await prisma.knowledgeBase.findMany({
            where: { accountId },
            select: { bedrockKnowledgeBaseId: true }
        });

        const existingIds = new Set(existing.map(kb => kb.bedrockKnowledgeBaseId));
        const unlinked = matchingKBs.filter(kb => !existingIds.has(kb.knowledgeBaseId));

        res.json(unlinked);
    } catch (err) {
        console.error('AWS KB fetch failed:', err);
        res.status(500).json({ error: 'Failed to fetch AWS KBs' });
    }
});



module.exports = router;