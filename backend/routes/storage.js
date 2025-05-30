const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');
const { getStorageClient } = require('../utils/storageClient');

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/storage/upload
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId }
        });

        if (!account || !account.storageBucket) {
            return res.status(400).json({ error: 'Tenant storage not provisioned' });
        }

        const storage = getStorageClient();
        const objectKey = `${Date.now()}-${file.originalname}`;

        await storage.putObject({
            Bucket: account.storageBucket,
            Key: objectKey,
            Body: file.buffer
        });

        res.status(200).json({
            message: 'File uploaded successfully',
            objectKey,
            bucket: account.storageBucket
        });
    } catch (err) {
        console.error('❌ Upload error:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// GET /api/storage/list
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId }
        });

        if (!account || !account.storageBucket) {
            return res.status(400).json({ error: 'Tenant storage not provisioned' });
        }

        const storage = getStorageClient();
        const { Contents = [] } = await storage.listObjectsV2({ Bucket: account.storageBucket });

        const files = Contents.map(obj => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified
        }));

        res.status(200).json({ files });
    } catch (err) {
        console.error('❌ List error:', err);
        res.status(500).json({ error: 'Failed to list objects' });
    }
});

console.log('📦 Exporting storage router:', typeof router);
module.exports = router;