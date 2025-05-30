// backend/scripts/testWeaviate.js
const client = require('../utils/weaviateClient');

try {
    const schema = client.schema.getter();
    console.log('✅ Weaviate schema:', JSON.stringify(schema, null, 2));
} catch (err) {
    console.error('❌ Failed to fetch Weaviate schema:', err);
}