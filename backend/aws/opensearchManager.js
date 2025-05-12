// backend/aws/opensearchManager.js
const {
    OpenSearchServerlessClient,
    CreateCollectionCommand,
    GetCollectionCommand
} = require('@aws-sdk/client-opensearchserverless');
const { v4: uuidv4 } = require('uuid');

const REGION = process.env.AWS_REGION;
const OPENSEARCH_ROLE_ARN = process.env.BEDROCK_KB_ROLE_ARN;
const PROJECT = 'fsds-rag';
const ENV = process.env.NODE_ENV || 'prod';

const osClient = new OpenSearchServerlessClient({ region: REGION });

async function createTenantCollection(tenantId) {
    const collectionName = `${PROJECT}-${ENV}-tenant-${tenantId}`.toLowerCase();

    const command = new CreateCollectionCommand({
        name: collectionName,
        type: 'VECTORSEARCH',
        description: `Vector collection for tenant ${tenantId}`,
        tags: [
            { key: 'TenantId', value: tenantId },
            { key: 'Project', value: PROJECT },
            { key: 'Environment', value: ENV },
            { key: 'Owner', value: 'aws_admin@fsdatasolutions.com' }
        ],
        networkPolicy: [{
            allowFromPublic: false,
            allowFromVpc: false,
            sourceVpce: [],
            awsService: ['bedrock.amazonaws.com'] // 🟢 THIS is what enables Bedrock to access
        }]
    });

    try {
        await osClient.send(command);
        return collectionName;
    } catch (err) {
        // If collection already exists, return it
        if (err.name === 'ConflictException') {
            const getCommand = new GetCollectionCommand({ names: [collectionName] });
            const res = await osClient.send(getCommand);
            if (res.collectionDetails.length > 0) return collectionName;
        }
        console.error('Failed to create OpenSearch collection:', err);
        throw err;
    }
}

module.exports = { createTenantCollection };
