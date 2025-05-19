// testCreateCollection.js

const {
    OpenSearchServerlessClient,
    CreateCollectionCommand
} = require('@aws-sdk/client-opensearchserverless');
require('dotenv').config();

const REGION = process.env.AWS_REGION;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

const opensearch = new OpenSearchServerlessClient({ region: REGION });

async function testCreateCollection() {
    const collectionName = `kb-test-${Math.floor(Math.random() * 10000)}`;

    console.log(`Creating test collection: ${collectionName}`);

    try {
        const result = await opensearch.send(new CreateCollectionCommand({
            name: collectionName,
            type: 'VECTORSEARCH',
            standalone: true // required for OpenSearch Serverless
        }));

        console.log('✅ Collection created successfully:', result);
    } catch (err) {
        console.error('❌ Failed to create collection:', err);
    }
}

testCreateCollection();