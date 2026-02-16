const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Email, password, and role are required' });
        }

        const user = await db.get(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            [email, role]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get patient details if user is a patient
        let patientId = null;
        if (role === 'patient') {
            const patient = await db.get(
                'SELECT id FROM patients WHERE user_id = ?',
                [user.id]
            );
            patientId = patient ? patient.id : null;
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, patientId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                patientId
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied - No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Verify token endpoint
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
