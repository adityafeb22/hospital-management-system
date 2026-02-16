const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath);

console.log('========================================');
console.log('Initializing Hospital Management System');
console.log('========================================\n');

db.serialize(() => {
    // Users table
    console.log('Creating users table...');
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('doctor', 'patient')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Patients table
    console.log('Creating patients table...');
    db.run(`CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        diagnosis TEXT,
        treatment TEXT,
        medication TEXT,
        notes TEXT,
        last_visit DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Appointments table
    console.log('Creating appointments table...');
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )`);

    // Fees table
    console.log('Creating fees table...');
    db.run(`CREATE TABLE IF NOT EXISTS fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        service TEXT,
        payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid')),
        payment_method TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )`);

    // Insert default doctor account
    console.log('Creating default doctor account...');
    const hashedPassword = bcrypt.hashSync('jahnavi123', 10);
    
    db.run(`INSERT OR IGNORE INTO users (name, email, password, role) 
            VALUES (?, ?, ?, ?)`,
        ['Dr. Jahnavi', 'jahnavi@clinic.com', hashedPassword, 'doctor'],
        function(err) {
            if (err) {
                console.error('Error creating doctor account:', err);
            } else {
                console.log('\n========================================');
                console.log('✓ Database initialized successfully!');
                console.log('========================================');
                console.log('\nDefault Doctor Login:');
                console.log('  Email: jahnavi@clinic.com');
                console.log('  Password: jahnavi123');
                console.log('\n========================================');
                console.log('Run "npm start" to start the server');
                console.log('========================================\n');
            }
        }
    );
});

db.close((err) => {
    if (err) {
        console.error('Error closing database:', err);
    }
});
