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
    CreateAccessPolicyCommand,
    BatchGetCollectionCommand,
    CreateSecurityPolicyCommand,
    TagResourceCommand, ListAccessPoliciesCommand
} = require('@aws-sdk/client-opensearchserverless');
const {
    EC2Client,
    CreateVpcEndpointCommand,
    DescribeVpcEndpointsCommand
} = require('@aws-sdk/client-ec2');

const {
    BedrockAgentClient,
    CreateKnowledgeBaseCommand,
    CreateDataSourceCommand,
    StartIngestionJobCommand
} = require('@aws-sdk/client-bedrock-agent');
const {waitForPolicyPropagation} = require("./utils");

const https = require('https');
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers');

const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { Sha256 } = require('@aws-crypto/sha256-js');
const { HttpRequest } = require('@aws-sdk/protocol-http');

const REGION = process.env.AWS_REGION;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const VPC_ID = process.env.AWS_VPC_ID;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'aws_admin@fsdatasolutions.com';
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const DEFAULT_MODEL_ARN = process.env.DEFAULT_EMBEDDING_MODEL ||
    'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v1';
const SERVICE_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-knowledgebase-role`;
//const SERVICE_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-kb-role`;
// Safely handle potentially undefined environment variables
const SUBNET_IDS = process.env.AWS_SUBNET_IDS ? process.env.AWS_SUBNET_IDS.split(',') : [];
const SECURITY_GROUP_IDS = process.env.AWS_SECURITY_GROUP_IDS ? process.env.AWS_SECURITY_GROUP_IDS.split(',') : [];
// Check if we have the necessary VPC configuration
const hasVpcConfig = VPC_ID && SUBNET_IDS.length > 0 && SECURITY_GROUP_IDS.length > 0;
const s3 = new S3Client({ region: REGION });
const opensearch = new OpenSearchServerlessClient({ region: REGION });
const ec2 = hasVpcConfig ? new EC2Client({ region: REGION }) : null;
const bedrock = new BedrockAgentClient({ region: REGION });

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

// Helper function to create tag object for Bedrock resources
function createBedrockTags(tenantId) {
    return {
        'TenantId': tenantId,
        'Project': 'fsds-rag',
        'Environment': ENVIRONMENT,
        'Owner': OWNER_EMAIL
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
            standalone: true
        }));

        createdResources.push({ type: 'opensearchCollection', name: collectionName });
        console.log(`✅ Sent request to create collection: ${collectionName}`);

        // 3. Wait for the collection to be available
        const MAX_RETRIES = 100;
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

        // Tag the collection

        const resourceArn = collection.arn; // ✅ this is the correct full ARN with collection ID
        const confirmedCollectionName = collection.name;
        // Create tags in the correct format for OpenSearch Serverless
        const ossTags = createResourceTags(tenantId).map(tag => ({
            key: tag.Key,
            value: tag.Value
        }));

        for (const tag of createResourceTags(tenantId)) {
            ossTags[tag.Key] = tag.Value;
        }

        console.log(`✅ createResourceTags:`, ossTags);

        await opensearch.send(new TagResourceCommand({
            resourceArn,
            tags: ossTags
        }));

        // 4. Create VPC endpoint only if VPC configuration is available
        console.log(`✅ Starting step 4: VPC endpoint provisioning`);
        console.log('hasVpcConfig:',hasVpcConfig)

        let vpcEndpointId = null;

        // commenting out while vpc endpoint not available in region
        // if (hasVpcConfig) {
        //     try {
        //         console.log(`🔍 Checking for existing VPC endpoint in VPC: ${VPC_ID}`);
        //
        //         const describeEndpointsResponse = await ec2.send(new DescribeVpcEndpointsCommand({
        //             Filters: [
        //                 { Name: 'vpc-id', Values: [VPC_ID] },
        //                 { Name: 'service-name', Values: [`com.amazonaws.${REGION}.aoss`] }
        //             ]
        //         }));
        //
        //         const endpoints = describeEndpointsResponse?.VpcEndpoints || [];
        //         const availableEndpoint = endpoints.find(ep => ep.State === 'available');
        //
        //         if (availableEndpoint) {
        //             vpcEndpointId = availableEndpoint.VpcEndpointId;
        //             console.log(`✅ Using existing VPC endpoint: ${vpcEndpointId}`);
        //         } else {
        //             console.log(`➕ No available VPC endpoint found. Creating a new one...`);
        //
        //             const createEndpointResponse = await ec2.send(new CreateVpcEndpointCommand({
        //                 VpcId: VPC_ID,
        //                 ServiceName: `com.amazonaws.${REGION}.aoss`,
        //                 SubnetIds: SUBNET_IDS,
        //                 SecurityGroupIds: SECURITY_GROUP_IDS,
        //                 VpcEndpointType: 'Interface',
        //                 PrivateDnsEnabled: true,
        //                 TagSpecifications: [
        //                     {
        //                         ResourceType: 'vpc-endpoint',
        //                         Tags: createResourceTags(tenantId)
        //                     }
        //                 ]
        //             }));
        //
        //             vpcEndpointId = createEndpointResponse?.VpcEndpoint?.VpcEndpointId;
        //             if (!vpcEndpointId) {
        //                 throw new Error('Failed to retrieve new VPC endpoint ID');
        //             }
        //
        //             createdResources.push({ type: 'vpcEndpoint', id: vpcEndpointId });
        //             console.log(`✅ Created new VPC endpoint: ${vpcEndpointId}`);
        //         }
        //     } catch (err) {
        //         console.error(`❌ Error during VPC endpoint setup:`, err);
        //         throw err;
        //     }
        // } else {
        //     console.warn(`⚠️ VPC configuration is missing or incomplete. Skipping VPC endpoint creation.`);
        // }

// 5. Create network policy with fallback to public access if no VPC endpoint
        const networkPolicyName = `net-${confirmedCollectionName}`;
        const networkPolicy = {
            name: networkPolicyName,
            type: 'network',
            description: `Network policy for collection ${confirmedCollectionName}`,
            policy: JSON.stringify([
                {
                    AllowFromPublic: false,
                    SourceServices: ["bedrock.amazonaws.com"],
                    Rules: [
                        {
                            ResourceType: "collection",
                            //Resource: [`collection/${resourceArn.split('/').pop()}`]
                            Resource: [`collection/${confirmedCollectionName}`]
                        }
                    ]
                }
            ])
        };

        console.log("Network policy being sent to AWS:");
        console.log(JSON.stringify(networkPolicy, null, 2));

        await opensearch.send(new CreateSecurityPolicyCommand(networkPolicy));
        createdResources.push({ type: 'networkPolicy', name: networkPolicyName });
        console.log(`✅ Created network policy for ${confirmedCollectionName}`);


// // 6. Create data access policy
//         // Create data access policy
//         const dataAccessPolicyName = `dap-${confirmedCollectionName}`;
//
// // Define the list of IAM roles allowed to access the collection and index
//         const allowedPrincipals = [
//             `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-kb-role`,
//            // `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-knowledgebase-role`
//         ];
//
//         const dataAccessPolicyDocument = {
//             Rules: [
//                 {
//                     ResourceType: "index",
//                     //Resource: [`index/${resourceArn.split('/').pop()}/*`],
//                     Resource: [`index/${confirmedCollectionName}/*`],
//                     Permission: ["aoss:CreateIndex", "aoss:UpdateIndex", "aoss:*"]
//                 },
//                 {
//                     ResourceType: "collection",
//                     //Resource: [`collection/${resourceArn.split('/').pop()}`],
//                     Resource: [`collection/${confirmedCollectionName}`],
//                     Permission: ["aoss:CreateIndex", "aoss:UpdateIndex", "aoss:*"]
//                 }
//             ],
//             Principal: allowedPrincipals
//         };
//
//         const dataAccessPolicy = {
//             name: dataAccessPolicyName,
//             type: "data",
//             description: `Data access policy for collection ${confirmedCollectionName}`,
//             policy: JSON.stringify([dataAccessPolicyDocument])
//         };
//
//         console.log("Data access policy being sent to AWS:");
//         console.log(JSON.stringify(dataAccessPolicy, null, 2));
//
//         await opensearch.send(new CreateAccessPolicyCommand(dataAccessPolicy));
//         createdResources.push({ type: 'dataAccessPolicy', name: dataAccessPolicyName });
//         console.log(`✅ Created access policy for collection: ${confirmedCollectionName}`);
//
//
//         await waitForPolicyPropagation(opensearch, dataAccessPolicyName,'data');

// 6. Create data access policy
        const dataAccessPolicyName = `dap-${confirmedCollectionName}`;

// Define the list of IAM roles allowed to access the collection and index
        const allowedPrincipals = [
            `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-kb-role`,
            `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-knowledgebase-role` // Uncommented this to ensure both roles have access
        ];

// For OpenSearch Serverless data access policies, we need to use the correct permissions and format
        const dataAccessPolicyDocument = {
            Rules: [
                {
                    // This covers all index operations including creation and updates
                    ResourceType: "index",
                    Resource: [`index/${confirmedCollectionName}/*`],
                    Permission: ["aoss:*"] // This includes all index operations
                }
            ],
            Principal: allowedPrincipals
        };

        const dataAccessPolicy = {
            name: dataAccessPolicyName,
            type: "data",
            description: `Data access policy for collection ${confirmedCollectionName}`,
            policy: JSON.stringify([dataAccessPolicyDocument])
        };

        console.log("Data access policy being sent to AWS:");
        console.log(JSON.stringify(dataAccessPolicy, null, 2));

        await opensearch.send(new CreateAccessPolicyCommand(dataAccessPolicy));
        createdResources.push({ type: 'dataAccessPolicy', name: dataAccessPolicyName });
        console.log(`✅ Created access policy for collection: ${confirmedCollectionName}`);

// Add extended wait for policy propagation
        console.log('🕒 Waiting for extended policy propagation...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second additional delay
        console.log('✅ Additional wait completed');

// Wait for policy propagation using your existing function
        await waitForPolicyPropagation(opensearch, dataAccessPolicyName, 'data');

// Add another delay after confirmation for good measure
        console.log('🕒 Adding final policy propagation buffer...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second buffer
        console.log('✅ Final wait completed - policies should be fully propagated');


        // ///////// Create vector Index ////////
        //
        // async function createVectorIndex(endpoint, indexName, region = 'us-west-2') {
        //     const cleanHost = endpoint.replace(/^https?:\/\//, '');
        //
        //     const bodyPayload = {
        //         mappings: {
        //             properties: {
        //                 vector_embedding: {
        //                     type: 'knn_vector',
        //                     dimension: 1536,
        //                     method: {
        //                         name: 'hnsw',
        //                         space_type: 'cosinesimil',
        //                         engine: 'faiss'
        //                     }
        //                 },
        //                 text_chunk: { type: 'text' },
        //                 metadata: { type: 'object' }
        //             }
        //         }
        //     };
        //
        //     const body = JSON.stringify(bodyPayload);
        //     const path = `/${indexName}`;
        //
        //     console.log('🔍 Preparing request to create vector index...');
        //     console.log('🔹 Endpoint Host:', cleanHost);
        //     console.log('🔹 Request Path:', path);
        //     console.log('🔹 Payload:', JSON.stringify(bodyPayload, null, 2));
        //
        //     const request = new HttpRequest({
        //         method: 'PUT',
        //         hostname: cleanHost,
        //         path,
        //         body,
        //         headers: {
        //             'Content-Type': 'application/json',
        //             host: cleanHost
        //         }
        //     });
        //
        //     // Use direct credentials instead of assuming a role
        //     const signer = new SignatureV4({
        //         credentials: defaultProvider(), // Use current credentials
        //         region,
        //         service: 'aoss',
        //         sha256: Sha256
        //     });
        //
        //     let signedRequest;
        //     try {
        //         signedRequest = await signer.sign(request);
        //         console.log('✅ Signed request successfully');
        //     } catch (signError) {
        //         console.error('❌ Failed to sign request:', signError);
        //         throw signError;
        //     }
        //
        //     // Add logging of request headers for debugging
        //     console.log('🔍 Request headers:', JSON.stringify(signedRequest.headers, null, 2));
        //
        //     return new Promise((resolve, reject) => {
        //         const req = https.request(
        //             {
        //                 hostname: signedRequest.hostname,
        //                 path: signedRequest.path,
        //                 method: signedRequest.method,
        //                 headers: signedRequest.headers
        //             },
        //             (res) => {
        //                 let data = '';
        //                 res.on('data', chunk => data += chunk);
        //                 res.on('end', () => {
        //                     console.log(`📡 Response Code: ${res.statusCode}`);
        //                     console.log(`📡 Response Headers:`, JSON.stringify(res.headers, null, 2));
        //                     console.log(`📡 Response Body: ${data}`);
        //
        //                     if (!data) {
        //                         console.error("❌ No response body returned. Likely an IAM/auth issue.");
        //                     }
        //
        //                     if (res.statusCode < 300) {
        //                         console.log(`✅ Vector index created: ${indexName}`);
        //                         resolve(data ? JSON.parse(data) : {});
        //                     } else {
        //                         console.error(`❌ Failed to create vector index: ${res.statusCode} - ${data}`);
        //                         reject(new Error(`Failed to create vector index: ${res.statusCode} - ${data}`));
        //                     }
        //                 });
        //             }
        //         );
        //
        //         req.on('error', (err) => {
        //             console.error('❌ HTTPS request error:', err);
        //             reject(err);
        //         });
        //
        //         req.write(signedRequest.body || '');
        //         req.end();
        //     });
        // }        const indexName = `${confirmedCollectionName}-index`;
        // try {
        //     console.log(`📌 Creating vector index in OpenSearch: ${indexName}`);
        //     await createVectorIndex(collection.collectionEndpoint, indexName, REGION);
        // } catch (err) {
        //     console.error(`⚠️ Skipped manual index creation:`, err.message);
        // }

        // 7. Create welcome document
        const welcomeContent = `# Welcome to Your Knowledge Base

This is your default knowledge base for ${account.name}.

## Getting Started
1. Upload documents through the web interface
2. Ask questions to leverage your knowledge base
3. Customize your knowledge base in the settings

## Quick Tips
- Try to upload documents with clearly defined sections
- You can organize documents by department
- Use keywords in your questions for better results

Created on: ${new Date().toISOString()}
For: ${account.name}
`;

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: 'welcome.md',
            Body: welcomeContent,
            ContentType: 'text/markdown',
            Tagging: `TenantId=${tenantId}&Project=fsds-rag&Environment=${ENVIRONMENT}&Owner=${encodeURIComponent(OWNER_EMAIL)}`
        }));
        console.log(`✅ Created welcome document in S3 bucket`);



        // 9. Create the default knowledge base
        console.log(`📝 Knowledge base configuration:`);
        const defaultKbName = `kb-${account.name}`.toLowerCase().replace(/[^a-z0-9_-]/gi, '-').slice(0, 100);

        console.log(JSON.stringify({
            name: defaultKbName,
            roleArn: SERVICE_ROLE_ARN,
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: collection.arn,
                    vectorIndexName: `${confirmedCollectionName}-index`
                }
            }
        }, null, 2));

// Then proceed with the knowledge base creation

        console.log("Creating knowledge base with parameters:");
        console.log(`Using service role: ${SERVICE_ROLE_ARN}`);backend/aws/provisionTenantResources.js
        console.log(JSON.stringify({
            name: defaultKbName,
            description: `Default knowledge base for ${account.name}`,
            roleArn: SERVICE_ROLE_ARN,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: DEFAULT_MODEL_ARN
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: collection.arn,
                    vectorIndexName: `${confirmedCollectionName}-index`,
                    fieldMapping: {
                        vectorField: 'vector_embedding',
                        textField: 'text_chunk',
                        metadataField: 'metadata'
                    }
                }
            }
        }, null, 2));

        const createKbResponse = await bedrock.send(new CreateKnowledgeBaseCommand({
            name: defaultKbName,
            description: `Default knowledge base for ${account.name}`,
            roleArn: SERVICE_ROLE_ARN,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: DEFAULT_MODEL_ARN
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: collection.arn,
                    vectorIndexName: `${confirmedCollectionName}-index`,
                    fieldMapping: {
                        vectorField: 'vector_embedding',
                        textField: 'text_chunk',
                        metadataField: 'metadata'
                    }
                }
            },
            tags: createBedrockTags(tenantId)
        }));

        const bedrockKnowledgeBaseId = createKbResponse.knowledgeBase.knowledgeBaseId;
        createdResources.push({ type: 'bedrockKnowledgeBase', id: bedrockKnowledgeBaseId });
        console.log(`✅ Created default knowledge base: ${bedrockKnowledgeBaseId}`);

        // 9. Create a data source for the knowledge base
        const dataSourceResponse = await bedrock.send(new CreateDataSourceCommand({
            knowledgeBaseId: bedrockKnowledgeBaseId,
            name: `${defaultKbName.substring(0, 20)}-datasource`,
            description: `Default data source for ${account.name}`,
            dataSourceConfiguration: {
                type: 'S3',
                s3Configuration: {
                    bucketArn: `arn:aws:s3:::${bucketName}`,
                    inclusionPrefixes: [''] // Include all files in the bucket for the default KB
                }
            },
            vectorIngestionConfiguration: {
                chunkingConfiguration: {
                    chunkingStrategy: 'FIXED_SIZE',
                    fixedSizeChunkingConfiguration: {
                        maxTokens: 300,
                        overlapPercentage: 10
                    }
                }
            },
            tags: createBedrockTags(tenantId)
        }));

        const dataSourceId = dataSourceResponse.dataSource.dataSourceId;
        createdResources.push({ type: 'bedrockDataSource', id: dataSourceId, knowledgeBaseId: bedrockKnowledgeBaseId });
        console.log(`✅ Created data source: ${dataSourceId}`);

        // 10. Start an initial ingestion job for the welcome document
        const ingestionResponse = await bedrock.send(new StartIngestionJobCommand({
            knowledgeBaseId: bedrockKnowledgeBaseId,
            dataSourceId: dataSourceId,
            description: 'Initial ingestion job'
        }));

        console.log(`✅ Started initial ingestion job: ${ingestionResponse.ingestionJob.ingestionJobId}`);

        // 11. Return comprehensive information including the new knowledge base details
        return {
            bucketName,
            vectorStoreArn: collection.arn,
            collectionEndpoint: `https://${collection.collectionEndpoint}`,
            tenantId,
            defaultKnowledgeBase: {
                name: defaultKbName,
                bedrockKnowledgeBaseId,
                dataSourceId,
                ingestionJobId: ingestionResponse.ingestionJob.ingestionJobId
            }
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
                case 'bedrockDataSource':
                    console.log(`Marking for cleanup: Bedrock data source: ${resource.id}`);
                    // Bedrock cleanup would go here
                    break;
                case 'bedrockKnowledgeBase':
                    console.log(`Marking for cleanup: Bedrock knowledge base: ${resource.id}`);
                    // Bedrock cleanup would go here
                    break;
                case 's3Bucket':
                    console.log(`Cleaning up S3 bucket: ${resource.name}`);
                    // You would need to empty the bucket first before deletion
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


