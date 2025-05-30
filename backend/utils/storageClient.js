/**
 * Returns an S3-compatible storage client.
 * Defaults to local MinIO for development.
 * Configure via .env: OBJECT_STORE_ACCESS_KEY, OBJECT_STORE_SECRET_KEY, S3_ENDPOINT
 */

const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    credentials: {
        accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY || 'minioadmin'
    },
    forcePathStyle: true
});

function getStorageClient() {
    return s3;
}

module.exports = { s3, getStorageClient };