const weaviate = require('weaviate-ts-client').default;

/**
 * Inserts a document chunk and its embedding vector into Weaviate.
 *
 * @param {Object} options
 * @param {string} options.kbId - The knowledge base ID (e.g., `kb-local`)
 * @param {string} options.text - The chunk of text
 * @param {number[]} options.vector - The embedding vector
 * @param {string} options.source - Optional file source path
 */
async function insertIntoWeaviate({ kbId, text, vector, source = '' }) {
    const client = weaviate.client({
        scheme: 'http',
        host: 'localhost:8081'
    });

    await client.data
        .creator()
        .withClassName('DocumentChunk')
        .withProperties({
            knowledgeBaseId: kbId,
            text,
            source
        })
        .withVector(vector)
        .do();
}

module.exports = insertIntoWeaviate;