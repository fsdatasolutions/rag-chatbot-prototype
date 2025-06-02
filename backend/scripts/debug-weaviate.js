// backend/scripts/debug-weaviate.js
const createClient = require('../utils/rag/weaviateClient');

async function listObjects(kbId) {
    const client = await createClient();
    const myCollection = client.collections.get('DocumentChunk');

    const results = await myCollection.query.fetchObjects({
        where: {
            path: ['knowledgeBaseId'],
            operator: 'Equal',
            valueText: kbId,
        },
        limit: 10,
        returnProperties: ['text', 'source', 'knowledgeBaseId'],
    });

    console.log(JSON.stringify(results, null, 2));
}

listObjects('caa445be-30df-4fd2-9f46-214733a27775');