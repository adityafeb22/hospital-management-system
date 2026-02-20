const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all fees
router.get('/', authenticateToken, async (req, res) => {
    try {
        let fees;
        
        if (req.user.role === 'doctor') {
            fees = await db.all(`
                SELECT f.*, p.name as patient_name, p.phone as patient_phone 
                FROM fees f
                JOIN patients p ON f.patient_id = p.id
                ORDER BY f.date DESC
            `);
        } else {
            fees = await db.all(
                'SELECT * FROM fees WHERE patient_id = ? ORDER BY date DESC',
                [req.user.patientId]
            );
        }

        res.json(fees);
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});

// Add fee record (doctor only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { patient_id, amount, service, payment_status, payment_method } = req.body;

        if (!patient_id || amount === undefined || amount === null) {
            return res.status(400).json({ error: 'Patient ID and amount are required' });
        }
        if (typeof amount !== 'number' && isNaN(parseFloat(amount))) {
            return res.status(400).json({ error: 'Amount must be a valid number' });
        }
        if (parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than zero' });
        }
        if (!service || !service.trim()) {
            return res.status(400).json({ error: 'Service description is required' });
        }

        const result = await db.run(
            'INSERT INTO fees (patient_id, amount, service, payment_status, payment_method) VALUES (?, ?, ?, ?, ?)',
            [patient_id, amount, service, payment_status || 'pending', payment_method]
        );

        const newFee = await db.get('SELECT * FROM fees WHERE id = ?', [result.id]);
        res.status(201).json(newFee);
    } catch (error) {
        console.error('Error adding fee:', error);
        res.status(500).json({ error: 'Failed to add fee' });
    }
});

// Update fee (doctor only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { amount, service, payment_status, payment_method } = req.body;

        if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
            return res.status(400).json({ error: 'Amount must be a valid number greater than zero' });
        }

        await db.run(
            'UPDATE fees SET amount = ?, service = ?, payment_status = ?, payment_method = ? WHERE id = ?',
            [amount, service, payment_status, payment_method, req.params.id]
        );

        const updatedFee = await db.get('SELECT * FROM fees WHERE id = ?', [req.params.id]);
        
        if (!updatedFee) {
            return res.status(404).json({ error: 'Fee record not found' });
        }

        res.json(updatedFee);
    } catch (error) {
        console.error('Error updating fee:', error);
        res.status(500).json({ error: 'Failed to update fee' });
    }
});

// Delete fee (doctor only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        await db.run('DELETE FROM fees WHERE id = ?', [req.params.id]);
        res.json({ message: 'Fee deleted successfully' });
    } catch (error) {
        console.error('Error deleting fee:', error);
        res.status(500).json({ error: 'Failed to delete fee' });
    }
});

// Get total revenue (doctor only)
router.get('/stats/revenue', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const result = await db.get('SELECT SUM(amount) as total FROM fees WHERE payment_status = ?', ['paid']);
        const pending = await db.get('SELECT SUM(amount) as total FROM fees WHERE payment_status = ?', ['pending']);
        
        res.json({ 
            totalRevenue: result.total || 0,
            pendingPayments: pending.total || 0
        });
    } catch (error) {
        console.error('Error calculating revenue:', error);
        res.status(500).json({ error: 'Failed to calculate revenue' });
    }
});

module.exports = router;
