// backend/routes/rag.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const embedText = require('../utils/rag/embedText');
const weaviateClient = require('../utils/weaviateClient');

// POST /api/rag/query
router.post('/query', authenticateToken, async (req, res) => {
    const { query, knowledgeBaseId, topK = 5 } = req.body;

    if (!query || !knowledgeBaseId) {
        return res.status(400).json({ error: 'query and knowledgeBaseId are required' });
    }

    try {
        const vector = await embedText(query);

        const result = await weaviateClient.graphql.get()
            .withClassName('DocumentChunk')
            .withFields('text source')
            .withWhere({
                path: ['knowledgeBaseId'],
                operator: 'Equal',
                valueString: knowledgeBaseId
            })
            .withNearVector({ vector, distance: 0.7 })
            .withLimit(topK)
            .do();

        const chunks = result?.data?.Get?.DocumentChunk || [];
        res.json({ chunks });
    } catch (err) {
        console.error('RAG query failed:', err);
        res.status(500).json({ error: 'RAG query failed' });
    }
});

module.exports = router;