// backend/scripts/reInsertWithEmbedding.js
const weaviate = require('../utils/weaviateClient');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const chunks = [
    {
        text: "Anthropic's Claude is optimized for helpful, honest, and harmless conversation.",
        source: 'https://www.anthropic.com/',
        knowledgeBaseId: 'kb-002',
    },
    {
        text: 'Weaviate is an open-source vector database that stores both objects and vectors.',
        source: 'https://weaviate.io',
        knowledgeBaseId: 'kb-001',
    },
    {
        text: 'OpenAI provides state-of-the-art language models via API.',
        source: 'https://openai.com/api',
        knowledgeBaseId: 'kb-002',
    },
    {
        text: 'Ollama makes it easy to run open models locally via simple commands.',
        source: 'http://localhost:11434',
        knowledgeBaseId: 'kb-local',
    },
    {
        text: 'Vector search enables semantic similarity matching using vector embeddings.',
        source: 'https://example.com/vector-search',
        knowledgeBaseId: 'kb-001',
    },
];

async function embed(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    const res = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
            input: text,
            model: 'text-embedding-ada-002',
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        }
    );
    return res.data.data[0].embedding;
}

async function run() {
    for (const chunk of chunks) {
        try {
            const vector = await embed(chunk.text);

            await weaviate.data
                .creator()
                .withClassName('DocumentChunk')
                .withId(uuidv4())
                .withProperties({
                    text: chunk.text,
                    source: chunk.source,
                    knowledgeBaseId: chunk.knowledgeBaseId,
                })
                .withVector(vector)
                .do();

            console.log('✅ Inserted with vector:', chunk.text.slice(0, 50));
        } catch (err) {
            console.error('❌ Failed to insert chunk:', err.message);
        }
    }
}

run();
