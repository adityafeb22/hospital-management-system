const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all appointments
router.get('/', authenticateToken, async (req, res) => {
    try {
        let appointments;
        
        if (req.user.role === 'doctor') {
            appointments = await db.all(`
                SELECT a.*, p.name as patient_name, p.phone as patient_phone 
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                ORDER BY a.date DESC, a.time DESC
            `);
        } else {
            appointments = await db.all(
                'SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, time DESC',
                [req.user.patientId]
            );
        }

        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Get appointments for today
router.get('/today', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const today = new Date().toISOString().split('T')[0];
        
        const appointments = await db.all(`
            SELECT a.*, p.name as patient_name, p.phone as patient_phone 
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.date = ?
            ORDER BY a.time ASC
        `, [today]);

        res.json(appointments);
    } catch (error) {
        console.error('Error fetching today appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Add appointment
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { patient_id, date, time, reason } = req.body;

        if (!date || !time) {
            return res.status(400).json({ error: 'Date and time are required' });
        }

        // If patient is booking, ensure they can only book for themselves
        const patientId = req.user.role === 'patient' ? req.user.patientId : patient_id;

        if (!patientId) {
            return res.status(400).json({ error: 'Patient ID is required' });
        }

        // Check for conflicting appointment at same date+time
        const conflict = await db.get(
            "SELECT id FROM appointments WHERE date = ? AND time = ? AND status = 'scheduled'",
            [date, time]
        );
        if (conflict) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose a different time.' });
        }

        const result = await db.run(
            'INSERT INTO appointments (patient_id, date, time, reason) VALUES (?, ?, ?, ?)',
            [patientId, date, time, reason]
        );

        const newAppointment = await db.get('SELECT * FROM appointments WHERE id = ?', [result.id]);
        res.status(201).json(newAppointment);
    } catch (error) {
        console.error('Error adding appointment:', error);
        res.status(500).json({ error: 'Failed to add appointment' });
    }
});

// Update appointment status (doctor only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { status } = req.body;

        if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await db.run(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, req.params.id]
        );

        const updatedAppointment = await db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
        
        if (!updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json(updatedAppointment);
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// Delete appointment
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        await db.run('DELETE FROM appointments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
});

module.exports = router;
