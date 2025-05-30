const embedText = require('./embedText');
const weaviateClient = require('../weaviateClient');

async function getRelevantChunks({ query, knowledgeBaseId, useVector = true, embeddingModel, topK = 5 }) {
    let weaviateQuery = weaviateClient.graphql
        .get()
        .withClassName('DocumentChunk')
        .withFields('text source')
        .withWhere({
            path: ['knowledgeBaseId'],
            operator: 'Equal',
            valueString: knowledgeBaseId
        })
        .withLimit(topK);

    if (useVector && embeddingModel) {
        try {
            const vector = await embedText(query, embeddingModel);
            weaviateQuery = weaviateQuery.withNearVector({ vector, distance: 0.7 });
        } catch (err) {
            console.warn('⚠️ Failed to embed query — falling back to nearText:', err.message);
            weaviateQuery = weaviateQuery.withNearText({ concepts: [query], distance: 0.7 });
        }
    } else {
        weaviateQuery = weaviateQuery.withNearText({ concepts: [query], distance: 0.7 });
    }

    const response = await weaviateQuery.do();
    return response?.data?.Get?.DocumentChunk || [];
}

module.exports = { getRelevantChunks };