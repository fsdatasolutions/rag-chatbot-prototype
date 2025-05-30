// backend/utils/provisionTenantResources.js
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.OBJECT_STORE_ENDPOINT,
    credentials: {
        accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY,
        secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY
    },
    forcePathStyle: true // required for MinIO
});

async function provisionTenantResources(account) {
    const bucketName = `tenant-${account.id}`.toLowerCase();

    try {
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Bucket created for account: ${bucketName}`);
    } catch (err) {
        if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
            console.warn(`⚠️ Bucket already exists: ${bucketName}`);
        } else {
            console.error(`❌ Failed to create bucket ${bucketName}:`, err);
            throw err;
        }
    }

    return {
        bucketName
    };
}

module.exports = {
    provisionTenantResources
};