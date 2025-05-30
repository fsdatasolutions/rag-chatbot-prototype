// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../db/prisma');
const { provisionTenantResources } = require('../utils/provisionTenantResources');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
        where: { email },
        include: { account: true }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
        {
            userId: user.id,
            accountId: user.accountId,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.json({ token });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { email, password, accountName } = req.body;

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ error: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const account = await prisma.account.create({
            data: {
                name: accountName,
                users: {
                    create: {
                        email,
                        passwordHash: hashedPassword,
                        role: 'admin'
                    }
                }
            },
            include: { users: true }
        });

        // 🔧 Provision tenant bucket using MinIO
        const { bucketName } = await provisionTenantResources(account);

        // 📝 Update account with storage bucket name
        await prisma.account.update({
            where: { id: account.id },
            data: {
                storageBucket: bucketName
            }
        });

        const user = account.users[0];
        const token = jwt.sign(
            {
                userId: user.id,
                accountId: user.accountId,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.status(201).json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to register' });
    }
});

module.exports = router;