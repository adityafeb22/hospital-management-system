const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto'); // built-in Node.js — no ESM issues
const supabase = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Multer — memory storage, 10 MB limit, PDF/image only
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, JPG and PNG files are allowed'));
        }
    }
});

// ── Helper: check access to a patient's diagnostics ──────────────────────────
function canAccessPatient(user, patientId) {
    if (user.role === 'doctor') return true;
    // Patients can only access their own record
    return user.patientId !== null && String(user.patientId) === String(patientId);
}

// GET /api/diagnostics/:patientId — list all diagnostics for a patient
router.get('/:patientId', authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;

        if (!canAccessPatient(req.user, patientId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data, error } = await supabase
            .from('diagnostics')
            .select('id, label, file_name, file_size, mime_type, notes, created_at, uploaded_by')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching diagnostics:', err);
        res.status(500).json({ error: 'Failed to fetch diagnostics' });
    }
});

// POST /api/diagnostics/:patientId — upload a file (doctor only)
router.post('/:patientId', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { label, notes } = req.body;
        if (!label || !label.trim()) {
            return res.status(400).json({ error: 'Label is required (e.g. Blood Test, X-Ray)' });
        }

        const { patientId } = req.params;

        // Verify patient exists
        const { data: patient, error: patientErr } = await supabase
            .from('patients')
            .select('id')
            .eq('id', patientId)
            .single();

        if (patientErr || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Build a safe, unique storage path
        const ext = req.file.originalname.split('.').pop().toLowerCase();
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${patientId}/${randomUUID()}-${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('diagnostics')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error('Failed to upload file to storage');
        }

        // Insert DB record
        const { data: record, error: dbError } = await supabase
            .from('diagnostics')
            .insert({
                patient_id: patientId,
                uploaded_by: req.user.id,
                label: label.trim(),
                file_name: req.file.originalname,
                file_path: filePath,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                notes: notes ? notes.trim() : null
            })
            .select()
            .single();

        if (dbError) {
            // Clean up orphaned storage file
            await supabase.storage.from('diagnostics').remove([filePath]);
            throw dbError;
        }

        res.status(201).json(record);
    } catch (err) {
        console.error('Error uploading diagnostic:', err);
        res.status(500).json({ error: err.message || 'Failed to upload diagnostic' });
    }
});

// GET /api/diagnostics/:patientId/:id/download — get a signed URL for a file
router.get('/:patientId/:id/download', authenticateToken, async (req, res) => {
    try {
        const { patientId, id } = req.params;

        if (!canAccessPatient(req.user, patientId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data: record, error } = await supabase
            .from('diagnostics')
            .select('file_path, file_name')
            .eq('id', id)
            .eq('patient_id', patientId)
            .single();

        if (error || !record) {
            return res.status(404).json({ error: 'Diagnostic not found' });
        }

        // Generate a signed URL valid for 1 hour
        const { data: signedData, error: signedError } = await supabase.storage
            .from('diagnostics')
            .createSignedUrl(record.file_path, 3600);

        if (signedError) {
            console.error('Signed URL error:', signedError);
            throw new Error('Failed to generate download link');
        }

        res.json({ url: signedData.signedUrl, file_name: record.file_name });
    } catch (err) {
        console.error('Error generating download URL:', err);
        res.status(500).json({ error: err.message || 'Failed to generate download link' });
    }
});

// DELETE /api/diagnostics/:patientId/:id — delete a diagnostic record + storage file (doctor only)
router.delete('/:patientId/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ error: 'Access denied - Doctors only' });
        }

        const { patientId, id } = req.params;

        const { data: record, error: fetchError } = await supabase
            .from('diagnostics')
            .select('file_path')
            .eq('id', id)
            .eq('patient_id', patientId)
            .single();

        if (fetchError || !record) {
            return res.status(404).json({ error: 'Diagnostic not found' });
        }

        // Delete from storage
        await supabase.storage.from('diagnostics').remove([record.file_path]);

        // Delete DB record
        const { error: dbError } = await supabase
            .from('diagnostics')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        res.json({ message: 'Diagnostic deleted successfully' });
    } catch (err) {
        console.error('Error deleting diagnostic:', err);
        res.status(500).json({ error: 'Failed to delete diagnostic' });
    }
});

// Multer error handler
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large — maximum size is 10 MB' });
        }
    }
    if (err) {
        return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
});

module.exports = router;
