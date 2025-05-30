// backend/utils/rag/kbUploadRAag.js
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// Configure MinIO-compatible S3 client
const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.OBJECT_STORE_ENDPOINT,
    credentials: {
        accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY,
        secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY
    },
    forcePathStyle: true
});

async function uploadToObjectStore({ accountId, kbName, fileName, content, bucket }) {
    if (!bucket) throw new Error('No bucket specified for object store');

    const prefix = `${accountId}/${kbName}/uploads/${uuidv4()}-${fileName}`;
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: prefix,
        Body: content
    });

    await s3.send(command);
    return { s3Key: prefix };
}

module.exports = {
    uploadToObjectStore
};