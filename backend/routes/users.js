// backend/routes/users.js
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');
const bcrypt = require('bcrypt');

// GET /api/users - list users in the current account
router.get('/', authenticateToken, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { accountId: req.user.accountId },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                department: true            }
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /api/users/me - returns logged in user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                role: true,
                department: true,
                createdAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Failed to fetch current user:', err);
        res.status(500).json({ error: 'Failed to fetch current user' });
    }
});

// POST /api/users - create a new user in the same account
router.post('/', authenticateToken, async (req, res) => {
    const { email, password, role, departmentId} = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can add users' });
    }

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                role,
                accountId: req.user.accountId,
                departmentId: departmentId || null
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });

        res.status(201).json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/users/:id - update user role, department, or password
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { role, departmentId, password } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update users' });
    }

    try {
        const updateData = {
            role,
            departmentId: departmentId || null
        };

        if (password && password.trim() !== '') {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        res.json(updatedUser);
    } catch (err) {
        console.error('Failed to update user:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;