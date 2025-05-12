const { Client } = require('@opensearch-project/opensearch');
const awsOpensearchConnector = require('aws-opensearch-connector');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
require('dotenv').config();

async function createOpenSearchIndex({ collectionEndpoint, indexName }) {
    console.log(`Attempting to create index "${indexName}" at endpoint: ${collectionEndpoint}`);
    console.log(`Using AWS Region: ${process.env.AWS_REGION}`);

    try {
        // Create AWS credentials provider
        const awsCredentialsProvider = defaultProvider();

        // Log credential info (be careful not to log actual secrets)
        const credentials = await awsCredentialsProvider();
        console.log(`Using credentials for: ${credentials.accessKeyId.substring(0, 4)}...`);

        // Create AWS connection
        const AWSConnection = awsOpensearchConnector({
            credentials: awsCredentialsProvider,
            region: process.env.AWS_REGION
        });

        // Create client
        const client = new Client({
            ...AWSConnection,
            node: collectionEndpoint,
            ssl: { rejectUnauthorized: true },
            // Adding request timeout
            requestTimeout: 10000
        });

        // Test connection first
        console.log("Testing connection to OpenSearch...");
        const healthCheck = await client.cluster.health({});
        console.log("Connection successful. Cluster status:", healthCheck.body?.status || "unknown");

        // Check if index exists
        console.log(`Checking if index "${indexName}" exists...`);
        const exists = await client.indices.exists({ index: indexName });

        if (exists.statusCode === 200) {
            console.log(`✅ OpenSearch index "${indexName}" already exists.`);
            return;
        }

        // Create index
        console.log(`Creating index "${indexName}"...`);
        const createResponse = await client.indices.create({
            index: indexName,
            body: {
                mappings: {
                    properties: {
                        vector: { type: 'knn_vector', dimension: 1536 },
                        text: { type: 'text' },
                        metadata: { type: 'object' }
                    }
                }
            }
        });

        console.log(`✅ Created OpenSearch index "${indexName}". Response:`, createResponse.statusCode);
    } catch (error) {
        console.error(`❌ Failed to create OpenSearch index "${indexName}":`, error);

        // Provide more diagnostic information
        if (error.meta?.statusCode === 403) {
            console.error("403 Forbidden Error - Authentication/Authorization issue:");
            console.error("- Check that your AWS credentials have permission to access OpenSearch");
            console.error("- Verify that the OpenSearch domain access policy allows your IAM role");
            console.error("- Ensure you're using the correct AWS region");

            // If there's a response body, log it
            if (error.meta?.body) {
                console.error("Response body:", error.meta.body);
            }
        }

        throw error;
    }
}

module.exports = { createOpenSearchIndex };