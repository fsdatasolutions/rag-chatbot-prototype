// backend/aws/uploadKnowledgeBaseFiles.js
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');
const path = require('path');
const fs = require('fs');

const PROJECT_TAGS = {
    Project: 'fsds-rag',
    Environment: process.env.NODE_ENV || 'dev',
    Owner: 'aws_admin@fsdatasolutions.com',
    ProvisionedBy: 'manual-upload',
    Team: 'platform-engineering'
};

/**
 * Uploads one or more files to a specific knowledge base folder in the tenant’s S3 bucket
 * @param {Object} params
 * @param {string} params.bucket - The name of the tenant’s S3 bucket
 * @param {string} params.kbName - Knowledge base name (used as S3 prefix)
 * @param {string} params.tenantId - Used for tagging
 * @param {Array<{ buffer: Buffer, originalname: string }>} params.files - Uploaded files
 */
async function uploadKnowledgeBaseFiles({ bucket, kbName, tenantId, files }) {
    if (!files || files.length === 0) return;
    const prefix = `knowledge-bases/${kbName.replace(/\s+/g, '-').toLowerCase()}`;

    const uploadPromises = files.map((file) => {
        const key = `${prefix}/${path.basename(file.originalname)}`;

        return s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file.buffer,
                Tagging: `TenantId=${tenantId}&Project=${PROJECT_TAGS.Project}&Environment=${PROJECT_TAGS.Environment}&Owner=${PROJECT_TAGS.Owner}&ProvisionedBy=${PROJECT_TAGS.ProvisionedBy}&Team=${PROJECT_TAGS.Team}`
            })
        );
    });

    await Promise.all(uploadPromises);
}

module.exports = uploadKnowledgeBaseFiles;