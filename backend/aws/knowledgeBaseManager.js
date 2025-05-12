// backend/aws/knowledgeBaseManager.js
const { BedrockAgentClient, CreateKnowledgeBaseCommand } = require('@aws-sdk/client-bedrock-agent');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');
const prisma = require('../db/prisma');
const { createOpenSearchIndex } = require('./createOpenSearchIndex');
const ENV = process.env.NODE_ENV || 'prod';
const PROJECT = 'fsds-rag';
const OWNER_EMAIL = 'aws_admin@fsdatasolutions.com';

const bedrockClient = new BedrockAgentClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Creates a Knowledge Base in AWS Bedrock from a URL or uploaded files.
 * @param {Object} options
 * @param {string} options.accountId
 * @param {string} options.kbName
 * @param {string} [options.url] - Optional: a URL to crawl for KB content
 * @param {Array<{ originalname: string, buffer: Buffer }>} [options.files] - Optional: files to upload to S3
 * @returns {Promise<{ bedrockKnowledgeBaseId: string }>}
 */
async function createKnowledgeBase({ accountId, kbName, url, files }) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || !account.s3Bucket) throw new Error('Account or S3 bucket not found');


    const indexName = `kb-${accountId.slice(0, 8)}`;
    const collectionEndpoint = `https://search-${account.opensearchCollection}.${process.env.AWS_REGION}.aoss.amazonaws.com`;

    await createOpenSearchIndex({
        collectionEndpoint,
        indexName
    });


    let sourceConfiguration;

    if (url) {
        sourceConfiguration = {
            webPage: { url }
        };
    } else if (files && files.length > 0) {
        const prefix = `knowledge-bases/${kbName}/`;

        for (const file of files) {
            await s3.send(new PutObjectCommand({
                Bucket: account.s3Bucket,
                Key: `${prefix}${file.originalname}`,
                Body: file.buffer,
                Tagging: `TenantId=tenant_${accountId}&Project=${PROJECT}&Environment=${ENV}&Owner=${OWNER_EMAIL}`
            }));
        }

        sourceConfiguration = {
            s3: {
                bucketArn: `arn:aws:s3:::${account.s3Bucket}`,
                prefix
            }
        };
    } else {
        throw new Error('Either URL or files must be provided');
    }


    const command = new CreateKnowledgeBaseCommand({
        name: kbName,
        roleArn: process.env.BEDROCK_KB_ROLE_ARN,
        knowledgeBaseConfiguration: {
            type: 'VECTOR',
            vectorKnowledgeBaseConfiguration: {
                embeddingModelArn: process.env.BEDROCK_EMBEDDING_MODEL_ARN
            }
        },
        storageConfiguration: {
            type: 'OPENSEARCH_SERVERLESS',
            opensearchServerlessConfiguration: {
                collectionArn: `arn:aws:aoss:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:collection/${account.opensearchCollection}`,
                vectorIndexName: `kb-${accountId.slice(0, 8)}`, // adjust naming logic as needed
                fieldMapping: {
                    vectorField: 'vector',
                    textField: 'text',
                    metadataField: 'metadata'
                }
            }
        },
        sourceConfiguration,
        tags: {
            TenantId: `tenant_${accountId}`,
            Project: PROJECT,
            Environment: ENV,
            Owner: OWNER_EMAIL
        }
    });
    console.log('command:',command);
    try {
        console.log("Creating knowledge base...");
        const result = await bedrockClient.send(command);
        console.log("✅ Knowledge base created:", result);
    } catch (error) {
        console.error("❌ Failed to create KB:", error);
    }
    const result = await bedrockClient.send(command);
    return { bedrockKnowledgeBaseId: result.knowledgeBase.knowledgeBaseId };
}

module.exports = { createKnowledgeBase };
