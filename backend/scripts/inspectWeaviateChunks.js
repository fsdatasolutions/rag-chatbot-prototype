// backend/scripts/inspectWeaviateChunks.js
const client = require('../utils/weaviateClient');

async function inspectChunks() {
    try {
        const result = await client.graphql.get()
            .withClassName('DocumentChunk')
            .withFields('text knowledgeBaseId _additional { id vector }')
            .withLimit(5)
            .do();

        const chunks = result?.data?.Get?.DocumentChunk || [];
        if (chunks.length === 0) {
            console.log('⚠️ No chunks found in Weaviate.');
        } else {
            console.log(`✅ Found ${chunks.length} chunk(s):`);
            chunks.forEach((chunk, idx) => {
                console.log(`\n🔹 Chunk #${idx + 1}`);
                console.log('Text:', chunk.text);
                console.log('KB ID:', chunk.knowledgeBaseId);
                console.log('Vector:', chunk._additional?.vector?.slice(0, 5), '...'); // show first 5 values
            });
        }
    } catch (err) {
        console.error('❌ Failed to fetch chunks from Weaviate:', err);
    }
}

inspectChunks();