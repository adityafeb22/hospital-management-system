const express = require('express');
const supabase = require('../database');
const { authenticateToken } = require('../middleware/auth');

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

// Get pending patients awaiting approval (doctor only)
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { data: patients, error } = await supabase
            .from('patients')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(patients);
    } catch (error) {
        console.error('Error fetching pending patients:', error);
        res.status(500).json({ error: 'Failed to fetch pending patients' });
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

// Add new patient (doctor only) — sends invite email via Supabase Auth
router.post('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { name, age, gender, phone, email, address, diagnosis, treatment, medication, notes } = req.body;

        if (!name || !age || !phone) {
            return res.status(400).json({ error: 'Name, age, and phone are required' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email is required to send the patient an invite' });
        }

        // Invite patient via Supabase Auth (sends invite email with set-password link)
        // Use the Railway backend URL — it serves set-password.html and is always reachable.
        // GitHub Pages URL is the preferred UX but requires Supabase dashboard whitelist.
        const RAILWAY_URL = 'https://hospital-management-system-production-4799.up.railway.app';
        const REDIRECT_URL = process.env.APP_URL
            ? `${process.env.APP_URL}/set-password.html`
            : `${RAILWAY_URL}/set-password.html`;

        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: { name, role: 'patient' },
            redirectTo: REDIRECT_URL
        });

        if (inviteError) {
            if (inviteError.message?.includes('already registered')) {
                return res.status(400).json({ error: 'A user with this email already exists' });
            }
            throw inviteError;
        }

        const authUserId = inviteData.user.id;

        // Insert profile row
        await supabase.from('profiles').insert({
            id: authUserId,
            name,
            role: 'patient',
            phone
        });

        // Create patient record linked to auth user
        const { data: newPatient, error: patientError } = await supabase
            .from('patients')
            .insert({
                user_id: authUserId,
                name, age, gender, phone, email,
                address, diagnosis, treatment, medication, notes,
                status: 'active'
            })
            .select()
            .single();

        if (patientError) throw patientError;

        res.status(201).json({
            patient: newPatient,
            message: `Invite email sent to ${email}. Patient can set their password via the link.`
        });
    } catch (error) {
        console.error('Error adding patient:', error);
        res.status(500).json({ error: 'Failed to add patient' });
    }
});

// Approve a pending patient (doctor only)
router.put('/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { data: patient, error } = await supabase
            .from('patients')
            .update({ status: 'active' })
            .eq('id', req.params.id)
            .eq('status', 'pending')
            .select()
            .single();

        if (error || !patient) {
            return res.status(404).json({ error: 'Pending patient not found' });
        }

        res.json({ message: 'Patient approved', patient });
    } catch (error) {
        console.error('Error approving patient:', error);
        res.status(500).json({ error: 'Failed to approve patient' });
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

// Delete patient (doctor only) — deletes auth user which cascades via FK
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        // Get user_id so we can delete the auth user (cascades to patient via FK)
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('user_id')
            .eq('id', req.params.id)
            .single();

        if (fetchError || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        if (patient.user_id) {
            // Delete auth user → cascades to profiles → cascades to patients
            await supabase.auth.admin.deleteUser(patient.user_id);
        } else {
            // No linked auth user, delete patient directly
            await supabase.from('patients').delete().eq('id', req.params.id);
        }

        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

module.exports = router;
