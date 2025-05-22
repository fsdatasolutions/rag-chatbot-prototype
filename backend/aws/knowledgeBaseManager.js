// backend/aws/knowledgeBaseManager.js
const {
    BedrockClient,
    CreateKnowledgeBaseCommand,
    CreateDataSourceCommand,
    StartIngestionJobCommand,
    ListDataSourcesCommand,
    GetKnowledgeBaseCommand,
    DeleteKnowledgeBaseCommand,
    DeleteDataSourceCommand,
    ListIngestionJobsCommand,
    StopIngestionJobCommand
} = require('@aws-sdk/client-bedrock');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const prisma = require('../db/prisma');
const { createOpenSearchIndex } = require('./createOpenSearchIndex');

// Configuration
const REGION = process.env.AWS_REGION || 'us-east-2';
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const DEFAULT_MODEL_ARN = process.env.BEDROCK_EMBEDDING_MODEL_ARN ||
    'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v1';
const SERVICE_ROLE_ARN = process.env.BEDROCK_KB_ROLE_ARN ||
    `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-knowledgebase-role`;
const ENVIRONMENT = process.env.NODE_ENV || 'prod';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'aws_admin@fsdatasolutions.com';
const PROJECT = 'fsds-rag';

// Initialize clients with credentials from environment variables
const bedrock = new BedrockClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Helper function to create standardized tags for Bedrock resources
 */
function createBedrockTags(tenantId) {
    return {
        'TenantId': tenantId,
        'Project': PROJECT,
        'Environment': ENVIRONMENT,
        'Owner': OWNER_EMAIL
    };
}

/**
 * Creates a Bedrock knowledge base
 * @param {Object} params - Parameters
 * @param {string} params.accountId - Account ID
 * @param {string} params.kbName - Knowledge base name
 * @param {Array} params.files - Optional files to upload and ingest
 * @param {string} params.url - Optional URL to crawl for KB content
 * @param {string} params.departmentId - Optional department ID to associate with knowledge base
 * @param {string} params.embeddingModelArn - Optional custom embedding model ARN
 * @returns {Object} - Contains knowledge base ID and data source details
 */
async function createKnowledgeBase({
                                       accountId,
                                       kbName,
                                       files = [],
                                       url = null,
                                       departmentId = null,
                                       embeddingModelArn = null
                                   }) {
    try {
        console.log(`Creating knowledge base "${kbName}" for account ${accountId}`);

        // Get account details
        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account?.vectorStoreArn || !account?.s3Bucket) {
            throw new Error('Account missing required AWS resource configuration');
        }

        const tenantId = `tenant-${accountId}`;
        const collectionName = `kb-${accountId.split('-')[0]}`;
        const indexName = `kb-${accountId.slice(0, 8)}`;

        // Use default model if none provided
        const modelArn = embeddingModelArn || DEFAULT_MODEL_ARN;

        // If account has a collectionEndpoint, initialize the OpenSearch index
        if (account.collectionEndpoint) {
            try {
                await createOpenSearchIndex({
                    collectionEndpoint: account.collectionEndpoint,
                    indexName
                });
                console.log(`✅ Created/verified OpenSearch index: ${indexName}`);
            } catch (indexError) {
                console.error('Error creating OpenSearch index:', indexError);
                // Continue anyway, as the collection might still work
            }
        }

        // Determine the source configuration based on whether URL or files are provided
        let sourceConfiguration = null;
        let kbPrefix = null;

        if (url) {
            sourceConfiguration = {
                webPage: { url }
            };
        } else if (files && files.length > 0) {
            // Create a unique path prefix for this knowledge base
            kbPrefix = `kb/${kbName}/`;

            // Upload files to S3 before creating the knowledge base
            for (const file of files) {
                await s3.send(new PutObjectCommand({
                    Bucket: account.s3Bucket,
                    Key: `${kbPrefix}${file.originalname}`,
                    Body: file.buffer,
                    ContentType: getContentType(file.originalname),
                    Tagging: `TenantId=${tenantId}&Project=${PROJECT}&Environment=${ENVIRONMENT}&Owner=${encodeURIComponent(OWNER_EMAIL)}`
                }));
                console.log(`Uploaded ${file.originalname} to ${account.s3Bucket}/${kbPrefix}`);
            }
        }

        // Create knowledge base
        const createKbResponse = await bedrock.send(new CreateKnowledgeBaseCommand({
            name: kbName,
            description: `Knowledge base: ${kbName}`,
            roleArn: SERVICE_ROLE_ARN,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: modelArn
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: account.vectorStoreArn,
                    vectorIndexName: indexName,
                    fieldMapping: {
                        vectorField: 'vector_embedding',
                        textField: 'text_chunk',
                        metadataField: 'metadata'
                    }
                }
            },
            // Include source configuration only if we have URL or files
            ...(sourceConfiguration && { sourceConfiguration }),
            tags: createBedrockTags(tenantId)
        }));

        const bedrockKnowledgeBaseId = createKbResponse.knowledgeBase.knowledgeBaseId;
        console.log(`✅ Created knowledge base: ${bedrockKnowledgeBaseId}`);

        let dataSourceId = null;
        let ingestionJobId = null;

        // If files were uploaded but not included in source configuration,
        // create a data source for this specific KB folder
        if (files && files.length > 0 && !sourceConfiguration) {
            // Create data source
            const dataSourceResponse = await bedrock.send(new CreateDataSourceCommand({
                knowledgeBaseId: bedrockKnowledgeBaseId,
                // Use a trimmed name to stay within AWS limits
                name: `${kbName.substring(0, 20)}-datasource`,
                description: `Data source for knowledge base: ${kbName}`,
                dataSourceConfiguration: {
                    type: 'S3',
                    s3Configuration: {
                        bucketArn: `arn:aws:s3:::${account.s3Bucket}`,
                        inclusionPrefixes: [kbPrefix]
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

            dataSourceId = dataSourceResponse.dataSource.dataSourceId;
            console.log(`✅ Created data source: ${dataSourceId}`);

            // Start ingestion job
            const ingestionResponse = await bedrock.send(new StartIngestionJobCommand({
                knowledgeBaseId: bedrockKnowledgeBaseId,
                dataSourceId: dataSourceId,
                description: `Initial ingestion for ${kbName}`
            }));

            ingestionJobId = ingestionResponse.ingestionJob.ingestionJobId;
            console.log(`✅ Started ingestion job: ${ingestionJobId}`);
        }

        return {
            bedrockKnowledgeBaseId,
            dataSourceId,
            ingestionJobId,
            modelArn
        };
    } catch (error) {
        console.error('Failed to create Bedrock knowledge base:', error);
        throw error;
    }
}

/**
 * List data sources for a knowledge base
 * @param {string} knowledgeBaseId - Knowledge base ID
 * @returns {Array} - List of data sources
 */
async function listDataSources(knowledgeBaseId) {
    try {
        const response = await bedrock.send(new ListDataSourcesCommand({
            knowledgeBaseId
        }));

        return response.dataSourceSummaries || [];
    } catch (error) {
        console.error(`Failed to list data sources for KB ${knowledgeBaseId}:`, error);
        throw error;
    }
}

/**
 * Get knowledge base details from Bedrock
 * @param {string} knowledgeBaseId - Knowledge base ID
 * @returns {Object} - Knowledge base details
 */
async function getKnowledgeBase(knowledgeBaseId) {
    try {
        const response = await bedrock.send(new GetKnowledgeBaseCommand({
            knowledgeBaseId
        }));

        return response.knowledgeBase;
    } catch (error) {
        console.error(`Failed to get knowledge base ${knowledgeBaseId}:`, error);
        throw error;
    }
}

/**
 * Delete a knowledge base and all its resources
 * @param {string} knowledgeBaseId - Knowledge base ID
 * @returns {boolean} - Success status
 */
async function deleteKnowledgeBase(knowledgeBaseId) {
    try {
        // First, get all data sources
        const dataSources = await bedrock.send(new ListDataSourcesCommand({
            knowledgeBaseId
        }));

        // Get all ingestion jobs for each data source and stop running ones
        for (const dataSource of dataSources.dataSourceSummaries || []) {
            try {
                const ingestionJobs = await bedrock.send(new ListIngestionJobsCommand({
                    knowledgeBaseId,
                    dataSourceId: dataSource.dataSourceId
                }));

                // Stop any running ingestion jobs
                for (const job of ingestionJobs.ingestionJobSummaries || []) {
                    if (job.status === 'STARTING' || job.status === 'IN_PROGRESS') {
                        try {
                            await bedrock.send(new StopIngestionJobCommand({
                                knowledgeBaseId,
                                dataSourceId: dataSource.dataSourceId,
                                ingestionJobId: job.ingestionJobId
                            }));
                            console.log(`Stopped ingestion job: ${job.ingestionJobId}`);
                        } catch (stopError) {
                            console.error(`Error stopping ingestion job ${job.ingestionJobId}:`, stopError);
                            // Continue with deletion anyway
                        }
                    }
                }

                // Delete the data source
                await bedrock.send(new DeleteDataSourceCommand({
                    knowledgeBaseId,
                    dataSourceId: dataSource.dataSourceId
                }));
                console.log(`Deleted data source: ${dataSource.dataSourceId}`);
            } catch (dsError) {
                console.error(`Error processing data source ${dataSource.dataSourceId}:`, dsError);
                // Continue with other deletions
            }
        }

        // Finally delete the knowledge base
        await bedrock.send(new DeleteKnowledgeBaseCommand({
            knowledgeBaseId
        }));
        console.log(`Deleted knowledge base: ${knowledgeBaseId}`);

        return true;
    } catch (error) {
        console.error(`Failed to delete knowledge base ${knowledgeBaseId}:`, error);
        throw error;
    }
}

/**
 * Upload a document to a KB's designated S3 location and trigger ingestion
 * @param {Object} params - Parameters
 * @param {string} params.bucketName - S3 bucket name
 * @param {string} params.kbName - Knowledge base name
 * @param {string} params.fileName - File name
 * @param {Buffer|string} params.content - File content
 * @param {string} params.knowledgeBaseId - Knowledge base ID
 * @param {string} params.dataSourceId - Data source ID
 * @param {string} params.tenantId - Tenant ID
 * @returns {Object} - Upload and ingestion details
 */
async function uploadKnowledgeBaseDocument({
                                               bucketName,
                                               kbName,
                                               fileName,
                                               content,
                                               knowledgeBaseId,
                                               dataSourceId,
                                               tenantId
                                           }) {
    try {
        // S3 key with KB-specific path
        const s3Key = `kb/${kbName}/${fileName}`;

        // Upload to S3
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: content,
            ContentType: getContentType(fileName),
            Tagging: `TenantId=${tenantId}&Project=${PROJECT}&Environment=${ENVIRONMENT}&Owner=${encodeURIComponent(OWNER_EMAIL)}`
        }));
        console.log(`Uploaded document to ${bucketName}/${s3Key}`);

        // Start ingestion if data source ID provided
        let ingestionJobId = null;
        if (knowledgeBaseId && dataSourceId) {
            const ingestionResponse = await bedrock.send(new StartIngestionJobCommand({
                knowledgeBaseId,
                dataSourceId,
                description: `Ingestion for document: ${fileName}`
            }));

            ingestionJobId = ingestionResponse.ingestionJob.ingestionJobId;
            console.log(`Started ingestion job: ${ingestionJobId}`);
        }

        return {
            s3Key,
            ingestionJobId
        };
    } catch (error) {
        console.error('Failed to upload knowledge base document:', error);
        throw error;
    }
}

/**
 * Helper function to determine the content type based on file name
 * @param {string} fileName - File name
 * @returns {string} - Content type
 */
function getContentType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const contentTypes = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'html': 'text/html',
        'csv': 'text/csv',
        'json': 'application/json',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return contentTypes[extension] || 'application/octet-stream';
}

/**
 * List all ingestion jobs for a specific data source
 * @param {string} knowledgeBaseId - Knowledge base ID
 * @param {string} dataSourceId - Data source ID
 * @returns {Array} - List of ingestion jobs
 */
async function listIngestionJobs(knowledgeBaseId, dataSourceId) {
    try {
        const response = await bedrock.send(new ListIngestionJobsCommand({
            knowledgeBaseId,
            dataSourceId
        }));

        return response.ingestionJobSummaries || [];
    } catch (error) {
        console.error(`Failed to list ingestion jobs for KB ${knowledgeBaseId}, DS ${dataSourceId}:`, error);
        throw error;
    }
}

module.exports = {
    createKnowledgeBase,
    getKnowledgeBase,
    deleteKnowledgeBase,
    uploadKnowledgeBaseDocument,
    listIngestionJobs,
    listDataSources
};