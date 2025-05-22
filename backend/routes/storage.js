const express = require('express');
const router = express.Router();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

const s3 = new S3Client({ region: process.env.AWS_REGION });

router.get('/s3-prefixes', authenticateToken, async (req, res) => {
    try {
        const account = await prisma.account.findUnique({
            where: { id: req.user.accountId }
        });

        if (!account || !account.s3Bucket) {
            return res.status(400).json({ error: 'S3 bucket not configured' });
        }

        console.log('🔍 Authenticated user accountId:', req.user.accountId);

        const command = new ListObjectsV2Command({
            Bucket: account.s3Bucket,
            Delimiter: '/',      // required for folder-style results
            Prefix: '',          // optional — '' gets top-level prefixes
            MaxKeys: 50          // keep it manageable
        });

        console.log('🔍 Listing objects in bucket:', account.s3Bucket);

        const response = await s3.send(command);
        console.log('📦 Raw ListObjectsV2 response:', JSON.stringify(response, null, 2));

        const prefixes = (response.CommonPrefixes || []).map(p => p.Prefix);
        console.log('✅ Found prefixes:', prefixes);

        res.json(prefixes);
    } catch (err) {
        console.error('Error listing S3 prefixes:', err);
        res.status(500).json({ error: 'Failed to list S3 prefixes' });
    }
});

module.exports = router;