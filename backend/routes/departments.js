// backend/routes/department.js
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const authenticateToken = require('../middleware/auth');

// GET /api/departments - get all departments for current account
router.get('/', authenticateToken, async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            where: { accountId: req.user.accountId },
            orderBy: { name: 'asc' }
        });
        res.json(departments);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Failed to load departments' });
    }
});

// POST /api/departments - create a department for the current account
router.post('/', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create departments' });
    }

    try {
        const department = await prisma.department.create({
            data: {
                name,
                accountId: req.user.accountId
            }
        });
        res.status(201).json(department);
    } catch (err) {
        console.error('Error creating department:', err); // <== confirm actual error
        res.status(500).json({ error: 'Failed to create department' });
    }
});

module.exports = router;
