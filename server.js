const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// ── Environment validation (fail fast on missing config) ──────────────────────
const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`FATAL: ${key} is not set. Add it to your .env file.`);
        process.exit(1);
    }
}
if (process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Use a longer, random secret in production.');
}

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const feeRoutes = require('./routes/fees');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS — allow GitHub Pages frontend + local dev ────────────────────────────
const allowedOrigins = [
    'https://adityafeb22.github.io',
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

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/fees', feeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hospital Management System API is running', db: 'Supabase (PostgreSQL)' });
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
║   Status:   ✓ Ready                                    ║
╚════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});
