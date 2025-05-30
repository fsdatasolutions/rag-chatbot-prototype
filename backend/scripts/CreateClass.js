// backend/scripts/createClass.js
const client = require('../utils/weaviateClient');

async function createDocumentClass() {
    try {
        await client.schema.classCreator().withClass({
            class: 'DocumentChunk',
            description: 'Chunks of documents for retrieval-augmented generation',
            vectorizer: 'none', // We'll push our own vectors from an embedding model
            properties: [
                {
                    name: 'text',
                    dataType: ['text'],
                    description: 'Chunk of document text'
                },
                {
                    name: 'source',
                    dataType: ['string'],
                    description: 'File name or URL source'
                },
                {
                    name: 'accountId',
                    dataType: ['string'],
                    description: 'Tenant ID for multi-tenant separation'
                }
            ]
        });

        console.log('✅ DocumentChunk class created successfully');
    } catch (err) {
        console.error('❌ Failed to create class:', err.message || err);
    }
}

createDocumentClass();