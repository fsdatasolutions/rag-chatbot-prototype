// backend/routes/kbStorage.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory-based upload handler
const prisma = require('../db/prisma');

const extractTextFromBuffer = require('../utils/rag/extractTextFromBuffer');
const embedText = require('../utils/rag/embedText');
const insertIntoWeaviate = require('../utils/rag/insertIntoWeaviate');
const { uploadToObjectStore } = require('../utils/rag/kbStorage');
const authenticateToken = require('../middleware/auth');

router.post('/:id/upload-rag', authenticateToken, upload.single('file'), async (req, res) => {
    const { id: knowledgeBaseId } = req.params;
    const { buffer, originalname } = req.file;

    if (!buffer || !originalname) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Step 1: Load KB and Account
        const kb = await prisma.knowledgeBase.findUnique({
            where: { id: knowledgeBaseId },
            include: { account: true }
        });

        if (!kb || kb.accountId !== req.user.accountId) {
            return res.status(404).json({ error: 'Knowledge base not found or access denied' });
        }

        const bucket = kb.account.storageBucket;
        if (!bucket) {
            return res.status(500).json({ error: 'Account is missing object storage bucket' });
        }

        // Step 2: Upload original file to MinIO
        const { s3Key } = await uploadToObjectStore({
            accountId: kb.accountId,
            kbName: kb.name,
            fileName: originalname,
            content: buffer,
            bucket
        });

        // Step 3: Extract text from uploaded file
        const text = await extractTextFromBuffer(buffer);

        // Step 4: Chunk and embed
        const chunks = text.match(/(.|[\r\n]){1,1000}/g); // naive chunking (can refine later)
        const vectors = await embedText(chunks);

        // Step 5: Insert into Weaviate
        await insertIntoWeaviate({
            kbId: knowledgeBaseId,
            texts: chunks,
            embeddings: vectors,
            metadata: { source: originalname }
        });

        res.status(200).json({ message: 'Document uploaded and processed successfully', s3Key });
    } catch (err) {
        console.error('❌ Failed to ingest documents:', err);
        res.status(500).json({ error: 'Document ingestion failed' });
    }
});

module.exports = router;