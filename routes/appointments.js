const express = require('express');
const supabase = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all appointments (role-filtered)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query;

        if (req.user.role === 'doctor') {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, patients(name, phone)')
                .order('date', { ascending: false })
                .order('time', { ascending: false });

            if (error) throw error;

            // Flatten patient join fields to match original API shape
            const appointments = (data || []).map(a => ({
                ...a,
                patient_name: a.patients?.name,
                patient_phone: a.patients?.phone,
                patients: undefined
            }));
            return res.json(appointments);
        } else {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('patient_id', req.user.patientId)
                .order('date', { ascending: false })
                .order('time', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Get today's appointments (doctor only)
router.get('/today', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('appointments')
            .select('*, patients(name, phone)')
            .eq('date', today)
            .order('time', { ascending: true });

        if (error) throw error;

        const appointments = (data || []).map(a => ({
            ...a,
            patient_name: a.patients?.name,
            patient_phone: a.patients?.phone,
            patients: undefined
        }));

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

        const patientId = req.user.role === 'patient' ? req.user.patientId : patient_id;

        if (!patientId) {
            return res.status(400).json({ error: 'Patient ID is required' });
        }

        // Check for conflicting appointment at same date+time
        const { data: conflict } = await supabase
            .from('appointments')
            .select('id')
            .eq('date', date)
            .eq('time', time)
            .eq('status', 'scheduled')
            .maybeSingle();

        if (conflict) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose a different time.' });
        }

        const { data: newAppointment, error } = await supabase
            .from('appointments')
            .insert({ patient_id: patientId, date, time, reason })
            .select()
            .single();

        if (error) throw error;
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

        const { data: updatedAppointment, error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error || !updatedAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json(updatedAppointment);
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// Delete appointment (doctor only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
});

module.exports = router;
