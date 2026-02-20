const express = require('express');
const supabase = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all fees (role-filtered)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'doctor') {
            const { data, error } = await supabase
                .from('fees')
                .select('*, patients(name, phone)')
                .order('date', { ascending: false });

            if (error) throw error;

            const fees = (data || []).map(f => ({
                ...f,
                patient_name: f.patients?.name,
                patient_phone: f.patients?.phone,
                patients: undefined
            }));
            return res.json(fees);
        } else {
            const { data, error } = await supabase
                .from('fees')
                .select('*')
                .eq('patient_id', req.user.patientId)
                .order('date', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});

// Get revenue stats (doctor only) — must be before /:id
router.get('/stats/revenue', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { data: paid } = await supabase
            .from('fees')
            .select('amount')
            .eq('payment_status', 'paid');

        const { data: pending } = await supabase
            .from('fees')
            .select('amount')
            .eq('payment_status', 'pending');

        const totalRevenue = (paid || []).reduce((s, f) => s + parseFloat(f.amount || 0), 0);
        const pendingPayments = (pending || []).reduce((s, f) => s + parseFloat(f.amount || 0), 0);

        res.json({ totalRevenue, pendingPayments });
    } catch (error) {
        console.error('Error calculating revenue:', error);
        res.status(500).json({ error: 'Failed to calculate revenue' });
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

        const { data: newFee, error } = await supabase
            .from('fees')
            .insert({ patient_id, amount: parseFloat(amount), service, payment_status: payment_status || 'pending', payment_method })
            .select()
            .single();

        if (error) throw error;
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

        const updateData = { service, payment_status, payment_method };
        if (amount !== undefined) updateData.amount = parseFloat(amount);

        const { data: updatedFee, error } = await supabase
            .from('fees')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error || !updatedFee) {
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

        const { error } = await supabase
            .from('fees')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Fee deleted successfully' });
    } catch (error) {
        console.error('Error deleting fee:', error);
        res.status(500).json({ error: 'Failed to delete fee' });
    }
});

module.exports = router;
