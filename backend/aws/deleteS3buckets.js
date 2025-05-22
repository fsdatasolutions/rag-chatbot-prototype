// deleteAllBuckets.js
const {
    S3Client,
    ListBucketsCommand,
    ListObjectVersionsCommand,
    ListMultipartUploadsCommand,
    AbortMultipartUploadCommand,
    DeleteObjectsCommand,
    DeleteBucketCommand
} = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-2';
const s3 = new S3Client({ region: REGION });

async function emptyBucket(bucketName) {
    try {
        let isTruncated = true;
        let keyMarker;
        let versionIdMarker;

        // Delete all versions and delete markers
        while (isTruncated) {
            const versionData = await s3.send(new ListObjectVersionsCommand({
                Bucket: bucketName,
                KeyMarker: keyMarker,
                VersionIdMarker: versionIdMarker
            }));

            const versions = versionData.Versions || [];
            const deleteMarkers = versionData.DeleteMarkers || [];
            const objectsToDelete = versions.concat(deleteMarkers).map(({ Key, VersionId }) => ({
                Key,
                VersionId
            }));

            if (objectsToDelete.length > 0) {
                await s3.send(new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: objectsToDelete }
                }));
            }

            isTruncated = versionData.IsTruncated;
            keyMarker = versionData.NextKeyMarker;
            versionIdMarker = versionData.NextVersionIdMarker;
        }

        // Abort any multipart uploads
        const multipartUploads = await s3.send(new ListMultipartUploadsCommand({ Bucket: bucketName }));
        if (multipartUploads.Uploads) {
            for (const upload of multipartUploads.Uploads) {
                await s3.send(new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: upload.Key,
                    UploadId: upload.UploadId
                }));
            }
        }

    } catch (err) {
        console.error(`❌ Error emptying bucket ${bucketName}:`, err);
    }
}

async function deleteAllBuckets() {
    try {
        const { Buckets } = await s3.send(new ListBucketsCommand());

        if (!Buckets || Buckets.length === 0) {
            console.log('✅ No buckets to delete.');
            return;
        }

        for (const { Name } of Buckets) {
            console.log(`🚮 Emptying and deleting bucket: ${Name}`);
            await emptyBucket(Name);
            await s3.send(new DeleteBucketCommand({ Bucket: Name }));
            console.log(`✅ Deleted bucket: ${Name}`);
        }
    } catch (err) {
        console.error('❌ Failed to delete buckets:', err);
    }
}

deleteAllBuckets();