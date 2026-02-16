const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all patients (doctor only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const patients = await db.all('SELECT * FROM patients ORDER BY created_at DESC');
        res.json(patients);
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// Get single patient
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const patient = await db.get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
        
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Check authorization
        if (req.user.role === 'patient' && req.user.patientId !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(patient);
    } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({ error: 'Failed to fetch patient' });
    }
});

// Add new patient (doctor only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { name, age, gender, phone, email, address, diagnosis, treatment, medication, notes } = req.body;

        if (!name || !age || !phone) {
            return res.status(400).json({ error: 'Name, age, and phone are required' });
        }

        // Create user account for patient
        const patientEmail = email || `${phone}@patient.com`;
        const defaultPassword = phone.slice(-4) + '123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const userResult = await db.run(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, patientEmail, hashedPassword, 'patient']
        );

        // Create patient record
        const patientResult = await db.run(
            `INSERT INTO patients (user_id, name, age, gender, phone, email, address, diagnosis, treatment, medication, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userResult.id, name, age, gender, phone, email, address, diagnosis, treatment, medication, notes]
        );

        const newPatient = await db.get('SELECT * FROM patients WHERE id = ?', [patientResult.id]);

        res.status(201).json({
            patient: newPatient,
            credentials: {
                email: patientEmail,
                password: defaultPassword
            }
        });
    } catch (error) {
        console.error('Error adding patient:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to add patient' });
        }
    }
});

// Update patient (doctor only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { name, age, gender, phone, email, address, diagnosis, treatment, medication, notes } = req.body;

        await db.run(
            `UPDATE patients SET name = ?, age = ?, gender = ?, phone = ?, email = ?, 
             address = ?, diagnosis = ?, treatment = ?, medication = ?, notes = ?, last_visit = CURRENT_DATE
             WHERE id = ?`,
            [name, age, gender, phone, email, address, diagnosis, treatment, medication, notes, req.params.id]
        );

        const updatedPatient = await db.get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
        
        if (!updatedPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(updatedPatient);
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Failed to update patient' });
    }
});

// Delete patient (doctor only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const patient = await db.get('SELECT user_id FROM patients WHERE id = ?', [req.params.id]);
        
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Delete user (will cascade delete patient)
        await db.run('DELETE FROM users WHERE id = ?', [patient.user_id]);

        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

module.exports = router;
