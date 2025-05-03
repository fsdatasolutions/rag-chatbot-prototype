// backend/aws/provisionTenantResources.js
const { S3Client, CreateBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: 'us-west-2', // change to your region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Provisions AWS infrastructure (S3 bucket) for a new tenant account
 * @param {Object} account - The created Prisma account object
 * @returns {Promise<{ bucketName: string }>}
 */
async function provisionTenantResources(account) {
    const tenantId = `tenant-${account.id}`;
    const bucketName = `fsdsrag-prod-${tenantId}`.toLowerCase();

    try {
        // Create a new bucket for the tenant
        await s3.send(new CreateBucketCommand({
            Bucket: bucketName,
        }));

        // Upload a placeholder file (optional, just to have content + tags)
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: 'init.txt',
            Body: 'Initial tenant file.',
            Tagging: `TenantId=${tenantId}&Project=fsds-rag&Environment=prod`
        }));

        return { bucketName };
    } catch (err) {
        console.error(`Failed to provision AWS resources for ${tenantId}:`, err);
        throw err;
    }
}

module.exports = {
    provisionTenantResources
};