require('dotenv').config();
const weaviateClient = require('../utils/weaviateClient');
const axios = require('axios');

async function embedQueryOpenAI(query) {
    const apiKey = process.env.OPENAI_API_KEY;
    const res = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
            input: query,
            model: 'text-embedding-ada-002'
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data.data[0].embedding;
}

async function testRagRetrieval(query, knowledgeBaseId) {
    try {
        const vector = await embedQueryOpenAI(query);

        const res = await weaviateClient.graphql.get()
            .withClassName('DocumentChunk')
            .withFields('text source')
            .withWhere({
                path: ['knowledgeBaseId'],
                operator: 'Equal',
                valueString: knowledgeBaseId
            })
            .withNearVector({ vector, certainty: 0.7 })
            .withLimit(5)
            .do();

        const chunks = res?.data?.Get?.DocumentChunk || [];
        if (chunks.length === 0) {
            console.log('⚠️ No results returned.');
        } else {
            console.log(`✅ Retrieved ${chunks.length} result(s):\n`);
            chunks.forEach((chunk, i) => {
                console.log(`${i + 1}. ${chunk.text}\n   → Source: ${chunk.source}\n`);
            });
        }
    } catch (err) {
        console.error('❌ RAG test failed:', err);
    }
}

const query = process.argv[2] || 'What is Weaviate?';
const kbId = process.argv[3] || 'kb-local';
testRagRetrieval(query, kbId);