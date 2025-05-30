// backend/scripts/batchInsertChunks.js
const client = require('../utils/weaviateClient');
const { v4: uuidv4 } = require('uuid');

// Sample chunks — you can customize or load these from files later
const chunks = [
    {
        text: 'Weaviate is an open-source vector database that stores both objects and vectors.',
        source: 'https://weaviate.io',
        knowledgeBaseId: 'kb-001',
    },
    {
        text: 'Vector search enables semantic similarity matching using vector embeddings.',
        source: 'https://example.com/vector-search',
        knowledgeBaseId: 'kb-001',
    },
    {
        text: 'OpenAI provides state-of-the-art language models via API.',
        source: 'https://openai.com/api',
        knowledgeBaseId: 'kb-002',
    },
    {
        text: "Anthropic's Claude is optimized for helpful, honest, and harmless conversation.",
        source: 'https://www.anthropic.com/',
        knowledgeBaseId: 'kb-002',
    },
    {
        text: 'Ollama makes it easy to run open models locally via simple commands.',
        source: 'http://localhost:11434',
        knowledgeBaseId: 'kb-local',
    },
];

(async () => {
    try {
        const batch = chunks.map(chunk => ({
            class: 'DocumentChunk',
            id: uuidv4(),
            properties: {
                text: chunk.text,
                source: chunk.source,
                knowledgeBaseId: chunk.knowledgeBaseId,
            },
        }));

        const result = await client.batch.objectsBatcher().withObjects(...batch).do();

        console.log('✅ Batch insert complete:', result);
    } catch (error) {
        console.error('❌ Error inserting chunks:', error);
    }
})();