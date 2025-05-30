// backend/utils/weaviateClient.js
//const weaviate = require('weaviate-ts-client');
const weaviate = require('weaviate-ts-client').default;

const client = weaviate.client({
    scheme: 'http',
    host: 'localhost:8081', // or your Weaviate instance URL
    // Add API keys here if needed (for Weaviate Cloud)
});

module.exports = client;