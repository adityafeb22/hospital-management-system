const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all patients (doctor only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { data: patients, error } = await supabase
            .from('patients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(patients);
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// Get single patient
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { data: patient, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Patients can only view their own record
        if (req.user.role === 'patient' && req.user.patientId !== patient.id) {
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

        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({ name, email: patientEmail, password: hashedPassword, role: 'patient' })
            .select()
            .single();

        if (userError) {
            if (userError.code === '23505') {
                return res.status(400).json({ error: 'Email already exists' });
            }
            throw userError;
        }

        // Create patient record
        const { data: newPatient, error: patientError } = await supabase
            .from('patients')
            .insert({ user_id: newUser.id, name, age, gender, phone, email, address, diagnosis, treatment, medication, notes })
            .select()
            .single();

        if (patientError) throw patientError;

        res.status(201).json({
            patient: newPatient,
            credentials: {
                email: patientEmail,
                password: defaultPassword
            }
        });
    } catch (error) {
        console.error('Error adding patient:', error);
        res.status(500).json({ error: 'Failed to add patient' });
    }
});

// Update patient (doctor only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { name, age, gender, phone, email, address, diagnosis, treatment, medication, notes } = req.body;

        const { data: updatedPatient, error } = await supabase
            .from('patients')
            .update({ name, age, gender, phone, email, address, diagnosis, treatment, medication, notes, last_visit: new Date().toISOString().split('T')[0] })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error || !updatedPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(updatedPatient);
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ error: 'Failed to update patient' });
    }
});

// Delete patient (doctor only) — cascades to appointments and fees via FK
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        // Get user_id so we can delete the user (which cascades to patient)
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('user_id')
            .eq('id', req.params.id)
            .single();

        if (fetchError || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', patient.user_id);

        if (error) throw error;
        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

module.exports = router;
