// routes/models.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const prisma = require('../db/prisma');



router.get('/embedding-models', (req, res) => {
    // Replace this with dynamic logic if needed later
    const models = [
        { id: 'amazon.titan-embed-text-v2:0', label: 'Titan Text Embeddings v2' },
        { id: 'amazon.titan-embed-text-v1', label: 'Titan Embed Text v1' },
        { id: 'cohere.embed-english-v1', label: 'Cohere Embed English v1' },
        { id: 'anthropic.embed-v1', label: 'Anthropic Embed v1' }
    ];
    res.json(models);
});


router.get('/vector-indexes', async (req, res) => {
    try {
        const data = await osClient.send(new ListCollectionsCommand({}));
        const indexes = (data?.collectionSummaries || [])
            .filter((c) => c.status === 'ACTIVE')
            .map((c) => ({
                name: c.name,
                arn: c.arn
            }));
        res.json(indexes);

    } catch (err) {
        console.error('Error fetching OpenSearch vector indexes:', err);
        res.status(500).json({ error: 'Failed to load OpenSearch indexes' });
    }
});

// GET /api/models/available — All active models (admins only can assign, but all can view/use)
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const models = await prisma.model.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                provider: true,
                providerModelId: true
            }
        });

        res.json(models);
    } catch (err) {
        console.error('❌ Failed to fetch models:', err);
        res.status(500).json({ error: 'Failed to fetch available models' });
    }
});

module.exports = router;