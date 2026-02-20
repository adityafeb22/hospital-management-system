const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// ── Environment validation (fail fast on missing config) ──────────────────────
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY'];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`FATAL: ${key} is not set. Add it to your .env file.`);
        process.exit(1);
    }
}

const supabase = require('./database');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const feeRoutes = require('./routes/fees');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS — allow GitHub Pages frontend + local dev ────────────────────────────
const allowedOrigins = [
    'https://adityafeb22.github.io',
    'https://hospital-management-system-production-4799.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ── Auth routes (Supabase Auth — no more custom JWT) ──────────────────────────

// Doctor login — uses Supabase Auth signInWithPassword server-side
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Sign in via Supabase Auth (anon key for user-facing auth)
        const { createClient } = require('@supabase/supabase-js');
        const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

        if (error || !data.user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Load profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', data.user.id)
            .single();

        if (!profile) {
            return res.status(401).json({ error: 'User profile not found' });
        }

        // Get patient record id if patient
        let patientId = null;
        if (profile.role === 'patient') {
            const { data: patient } = await supabase
                .from('patients')
                .select('id, status')
                .eq('user_id', data.user.id)
                .single();

            if (patient?.status === 'pending') {
                return res.status(403).json({ error: 'Your account is pending doctor approval.' });
            }
            patientId = patient ? patient.id : null;
        }

        res.json({
            token: data.session.access_token,
            user: {
                id: data.user.id,
                name: profile.name,
                email: data.user.email,
                role: profile.role,
                patientId
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Patient self-signup (creates pending account, doctor must approve)
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }

        // Create auth user (confirmed immediately — no email confirm for self-signup)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'patient' }
        });

        if (authError) {
            if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
                return res.status(400).json({ error: 'An account with this email already exists' });
            }
            throw authError;
        }

        const uid = authData.user.id;

        // Insert profile
        await supabase.from('profiles').insert({ id: uid, name, role: 'patient', phone: phone || null });

        // Create patient record with pending status (doctor must approve)
        await supabase.from('patients').insert({
            user_id: uid,
            name,
            email,
            phone: phone || '',
            age: 0,          // placeholder — doctor fills in on approval
            status: 'pending'
        });

        res.status(201).json({ message: 'Account created! Awaiting doctor approval before you can log in.' });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// Token verify endpoint (for frontend session restore)
app.get('/api/auth/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(403).json({ error: 'Invalid token' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();

    let patientId = null;
    if (profile?.role === 'patient') {
        const { data: patient } = await supabase
            .from('patients')
            .select('id, status')
            .eq('user_id', user.id)
            .single();

        if (patient?.status === 'pending') {
            return res.status(403).json({ error: 'Your account is pending doctor approval.' });
        }
        patientId = patient?.id || null;
    }

    if (!profile) {
        return res.status(403).json({ error: 'User profile not found. Please contact your doctor.' });
    }

    res.json({
        valid: true,
        user: { id: user.id, email: user.email, name: profile.name, role: profile.role, patientId }
    });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/fees', feeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hospital Management System API is running', db: 'Supabase (PostgreSQL)', auth: 'Supabase Auth' });
});

// Serve frontend (for self-hosted fallback — GitHub Pages is primary)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║     Hospital Management System - Server Running       ║
╠════════════════════════════════════════════════════════╣
║   Port:     ${PORT}                                        ║
║   URL:      http://localhost:${PORT}                       ║
║   Database: Supabase (PostgreSQL)                      ║
║   Auth:     Supabase Auth                              ║
║   Status:   ✓ Ready                                    ║
╚════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});
