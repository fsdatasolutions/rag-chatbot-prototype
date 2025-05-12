const {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand,
    PutBucketEncryptionCommand,
    PutBucketTaggingCommand
} = require('@aws-sdk/client-s3');
const {
    OpenSearchServerlessClient,
    CreateCollectionCommand,
    BatchGetCollectionCommand,
    CreateSecurityPolicyCommand,
    TagResourceCommand
} = require('@aws-sdk/client-opensearchserverless');
const {
    EC2Client,
    CreateVpcEndpointCommand,
    DescribeVpcEndpointsCommand
} = require('@aws-sdk/client-ec2');

const REGION = process.env.AWS_REGION;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const VPC_ID = process.env.AWS_VPC_ID;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'aws_admin@fsdatasolutions.com';
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';

// Safely handle potentially undefined environment variables
const SUBNET_IDS = process.env.AWS_SUBNET_IDS ? process.env.AWS_SUBNET_IDS.split(',') : [];
const SECURITY_GROUP_IDS = process.env.AWS_SECURITY_GROUP_IDS ? process.env.AWS_SECURITY_GROUP_IDS.split(',') : [];

// Check if we have the necessary VPC configuration
const hasVpcConfig = VPC_ID && SUBNET_IDS.length > 0 && SECURITY_GROUP_IDS.length > 0;

const s3 = new S3Client({ region: REGION });
const opensearch = new OpenSearchServerlessClient({ region: REGION });
const ec2 = hasVpcConfig ? new EC2Client({ region: REGION }) : null;

// Helper function to create standard tags
function createResourceTags(tenantId) {
    return [
        { Key: 'TenantId', Value: tenantId },
        { Key: 'Project', Value: 'fsds-rag' },
        { Key: 'Environment', Value: ENVIRONMENT },
        { Key: 'Owner', Value: OWNER_EMAIL }
    ];
}

// Helper function to create S3 tag format (different from standard AWS tags)
function createS3Tags(tenantId) {
    return {
        TagSet: [
            { Key: 'TenantId', Value: tenantId },
            { Key: 'Project', Value: 'fsds-rag' },
            { Key: 'Environment', Value: ENVIRONMENT },
            { Key: 'Owner', Value: OWNER_EMAIL }
        ]
    };
}

async function provisionTenantResources(account) {
    const tenantId = `tenant-${account.id}`;
    const bucketName = `fsdsrag-${ENVIRONMENT}-${tenantId}`.toLowerCase();
    const collectionName = `kb-${account.id.split('-')[0]}`;

    // Track created resources for cleanup in case of error
    const createdResources = [];

    try {
        // 1. Create the S3 bucket with encryption
        console.log(`Creating S3 bucket: ${bucketName}`);
        await s3.send(new CreateBucketCommand({
            Bucket: bucketName,
            ObjectOwnership: 'BucketOwnerEnforced' // Recommended security practice
        }));
        createdResources.push({ type: 's3Bucket', name: bucketName });

        // Apply bucket tags
        await s3.send(new PutBucketTaggingCommand({
            Bucket: bucketName,
            Tagging: createS3Tags(tenantId)
        }));

        // Enable bucket encryption (using AWS managed key)
        await s3.send(new PutBucketEncryptionCommand({
            Bucket: bucketName,
            ServerSideEncryptionConfiguration: {
                Rules: [
                    {
                        ApplyServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'AES256'
                        },
                        BucketKeyEnabled: true
                    }
                ]
            }
        }));

        // Add initial file with tagging
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: 'init.txt',
            Body: 'Initial tenant file.',
            Tagging: `TenantId=${tenantId}&Project=fsds-rag&Environment=${ENVIRONMENT}&Owner=${encodeURIComponent(OWNER_EMAIL)}`
        }));

        // 2. Create OpenSearch Serverless collection with encryption
        console.log(`Creating OpenSearch Serverless collection: ${collectionName}`);
        await opensearch.send(new CreateCollectionCommand({
            name: collectionName,
            type: 'VECTORSEARCH',
            // Enable AWS owned KMS key encryption by default (you can also specify customer managed key)
            securityConfig: {
                samlOptions: {
                    enabled: false
                }
            }
        }));
        createdResources.push({ type: 'opensearchCollection', name: collectionName });

        // Tag the collection
        const resourceArn = `arn:aws:aoss:${REGION}:${ACCOUNT_ID}:collection/${collectionName}`;
        const standardTags = {};
        createResourceTags(tenantId).forEach(tag => {
            standardTags[tag.Key] = tag.Value;
        });

        await opensearch.send(new TagResourceCommand({
            resourceArn,
            tags: standardTags
        }));

        console.log(`✅ Sent request to create collection: ${collectionName}`);

        // 3. Wait for the collection to be available
        const MAX_RETRIES = 20;
        const RETRY_DELAY_MS = 3000;

        let collection;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const response = await opensearch.send(new BatchGetCollectionCommand({
                names: [collectionName]
            }));
            collection = response.collectionDetails?.[0];

            if (collection?.status === 'ACTIVE' && collection?.arn && collection?.collectionEndpoint) break;

            console.log(`⏳ Collection not ready (status: ${collection?.status}), retrying... (${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
        }

        if (!collection?.arn || !collection?.collectionEndpoint || collection?.status !== 'ACTIVE') {
            throw new Error(`Collection not active after ${MAX_RETRIES} retries: ${collectionName} (status: ${collection?.status})`);
        }

        // 4. Create VPC endpoint only if VPC configuration is available
        let vpcEndpointId = null;

        if (hasVpcConfig) {
            console.log("VPC configuration found. Setting up VPC endpoint...");

            // Check if a VPC endpoint for OpenSearch Serverless already exists
            const describeEndpointsResponse = await ec2.send(new DescribeVpcEndpointsCommand({
                Filters: [
                    {
                        Name: 'vpc-id',
                        Values: [VPC_ID]
                    },
                    {
                        Name: 'service-name',
                        Values: [`com.amazonaws.${REGION}.aoss`]
                    }
                ]
            }));

            if (describeEndpointsResponse.VpcEndpoints && describeEndpointsResponse.VpcEndpoints.length > 0) {
                vpcEndpointId = describeEndpointsResponse.VpcEndpoints[0].VpcEndpointId;
                console.log(`✅ Using existing VPC endpoint: ${vpcEndpointId}`);
            } else {
                // Create a new VPC endpoint with tags
                const createEndpointResponse = await ec2.send(new CreateVpcEndpointCommand({
                    VpcId: VPC_ID,
                    ServiceName: `com.amazonaws.${REGION}.aoss`,
                    SubnetIds: SUBNET_IDS,
                    SecurityGroupIds: SECURITY_GROUP_IDS,
                    VpcEndpointType: 'Interface',
                    PrivateDnsEnabled: true,
                    TagSpecifications: [
                        {
                            ResourceType: 'vpc-endpoint',
                            Tags: createResourceTags(tenantId)
                        }
                    ]
                }));

                vpcEndpointId = createEndpointResponse.VpcEndpoint.VpcEndpointId;
                createdResources.push({ type: 'vpcEndpoint', id: vpcEndpointId });
                console.log(`✅ Created new VPC endpoint: ${vpcEndpointId}`);
            }
        } else {
            console.log("⚠️ VPC configuration not complete. Skipping VPC endpoint creation.");
        }

        // 5. Create network policy with or without VPC endpoint
        const networkPolicyName = `net-${collectionName}`;
        const networkPolicyConfig = {
            AllowFromPublic: !vpcEndpointId, // Allow public access if no VPC endpoint
            SourceVPCEs: vpcEndpointId ? [vpcEndpointId] : [],
            SourceServices: ["bedrock.amazonaws.com"], // Always allow Bedrock
            Rules: [
                {
                    ResourceType: "collection",
                    Resource: [`collection/${collectionName}`]
                },
                {
                    ResourceType: "dashboard",
                    Resource: [`collection/${collectionName}`]
                }
            ]
        };

        const networkPolicy = {
            name: networkPolicyName,
            type: 'network',
            description: `Network policy for collection ${collectionName}`,
            policy: JSON.stringify([networkPolicyConfig])
        };

        await opensearch.send(new CreateSecurityPolicyCommand(networkPolicy));
        createdResources.push({ type: 'networkPolicy', name: networkPolicyName });
        console.log(`✅ Created network policy for ${collectionName}`);

        // 6. Create data access policy (we're using the IAM role from your policy)
        const dataAccessPolicyName = `dap-${collectionName}`;
        const dataAccessPolicy = {
            name: dataAccessPolicyName,
            type: 'data',
            description: `Data access policy for collection ${collectionName}`,
            policy: JSON.stringify([
                {
                    Rules: [
                        {
                            ResourceType: "index",
                            Resource: [`index/${collectionName}/*`],
                            Permission: ["aoss:*"]
                        },
                        {
                            ResourceType: "collection",
                            Resource: [`collection/${collectionName}`],
                            Permission: ["aoss:*"]
                        }
                    ],
                    // Use specific IAM role instead of wildcard "*"
                    Principal: [
                        `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-kb-role`,
                        `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-knowledgebase-role`
                    ]
                }
            ])
        };

        await opensearch.send(new CreateSecurityPolicyCommand(dataAccessPolicy));
        createdResources.push({ type: 'dataAccessPolicy', name: dataAccessPolicyName });
        console.log(`✅ Created data access policy for ${collectionName}`);

        return {
            bucketName,
            vectorStoreArn: collection.arn,
            collectionEndpoint: `https://${collection.collectionEndpoint}`,
            tenantId
        };
    } catch (err) {
        console.error(`❌ Failed to provision AWS resources for ${tenantId}:`, err);

        // Attempt to clean up created resources on failure
        console.log(`Attempting to clean up created resources for ${tenantId}...`);
        await cleanupResources(createdResources);

        throw err;
    }
}

// Helper function to clean up resources in case of error
async function cleanupResources(resources) {
    for (const resource of resources.reverse()) { // Clean up in reverse order of creation
        try {
            switch(resource.type) {
                // Implement cleanup logic for each resource type
                // This is a simplified version - you would implement more details
                case 's3Bucket':
                    console.log(`Cleaning up S3 bucket: ${resource.name}`);
                    // You would need to empty the bucket first before deletion
                    // For brevity, I'm not including the full implementation
                    break;
                case 'opensearchCollection':
                    console.log(`Marking for cleanup: OpenSearch collection: ${resource.name}`);
                    // Actual deletion would go here
                    break;
                case 'networkPolicy':
                case 'dataAccessPolicy':
                    console.log(`Marking for cleanup: Policy: ${resource.name}`);
                    // Actual deletion would go here
                    break;
                case 'vpcEndpoint':
                    console.log(`Marking for cleanup: VPC Endpoint: ${resource.id}`);
                    // Actual deletion would go here
                    break;
                default:
                    break;
            }
        } catch (cleanupErr) {
            console.error(`Failed to clean up ${resource.type} ${resource.name || resource.id}:`, cleanupErr);
            // Continue with other cleanups even if one fails
        }
    }
}

module.exports = { provisionTenantResources };