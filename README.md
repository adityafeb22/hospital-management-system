# 🏥 Hospital Management System for Dr. Jahnavi's Clinic

A complete hospital management system built with Node.js, Express, SQLite, and React. Designed specifically for small to medium-sized clinics in India.

## ✨ Features

### For Doctors
- 📊 **Dashboard** - Real-time overview of clinic operations
- 👥 **Patient Management** - Add, edit, and track patient records
- 📅 **Appointment Scheduling** - Manage daily appointments and queue
- 💰 **Fee Management** - Track payments and revenue with UPI integration
- 📝 **Medical Records** - Store diagnosis, treatment, and medication details
- 📱 **Mobile Responsive** - Works on desktop, tablet, and mobile

### For Patients
- 🔐 **Personal Portal** - Secure access to medical records
- 📱 **Self-Service Booking** - Book appointments online
- 💳 **Payment Tracking** - View payment history and pending bills
- 🏥 **Medical History** - Access prescriptions and treatment plans

### Indian-Specific Features
- ₹ Rupee currency formatting
- 📲 UPI payment integration (drjahnavi@paytm)
- 🇮🇳 Indian date/time formats
- 🏥 Designed for Indian healthcare practices

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download this repository**
```bash
cd hospital-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Initialize the database**
```bash
npm run init-db
```

4. **Start the server**
```bash
npm start
```

5. **Open your browser**
```
http://localhost:3000
```

## 🔑 Default Login Credentials

### Doctor Account
- **Email:** jahnavi@clinic.com
- **Password:** jahnavi123

### Patient Accounts
Patient credentials are automatically generated when the doctor adds a new patient:
- **Email:** [phone]@patient.com (or provided email)
- **Password:** Last 4 digits of phone + "123"

Example: If phone is 9876543210, password will be 3210123

## 📂 Project Structure

```
hospital-system/
├── package.json          # Project dependencies
├── .env                  # Environment configuration
├── database.js           # SQLite database wrapper
├── init-database.js      # Database initialization script
├── server.js             # Express server
├── routes/               # API routes
│   ├── auth.js          # Authentication
│   ├── patients.js      # Patient management
│   ├── appointments.js  # Appointment management
│   └── fees.js          # Fee management
└── public/
    └── index.html       # Frontend React application
```

## 🔧 Configuration

Edit the `.env` file to customize:

```env
PORT=3000
JWT_SECRET=your_secret_key_here
DATABASE_PATH=./hospital.db
```

## 📊 Database Schema

### Users
- id, name, email, password, role (doctor/patient)

### Patients
- id, user_id, name, age, gender, phone, email, address
- diagnosis, treatment, medication, notes

### Appointments
- id, patient_id, date, time, reason, status

### Fees
- id, patient_id, amount, service, payment_status, payment_method

## 🛠️ Development

### Run in development mode with auto-restart
```bash
npm run dev
```

### Reset database
```bash
rm hospital.db
npm run init-db
```

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (Doctor/Patient)
- SQL injection prevention
- CORS enabled for API access

## 📱 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify token

### Patients (Doctor only)
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get single patient
- `POST /api/patients` - Add patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Appointments
- `GET /api/appointments` - Get appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Fees (Doctor only for write operations)
- `GET /api/fees` - Get fee records
- `POST /api/fees` - Add fee record
- `PUT /api/fees/:id` - Update fee
- `DELETE /api/fees/:id` - Delete fee
- `GET /api/fees/stats/revenue` - Get revenue stats

## 🎨 Customization

### Change UPI ID
Edit in both backend (`routes/fees.js`) and frontend (`public/index.html`)

### Add More Features
1. Add new routes in `routes/` folder
2. Register routes in `server.js`
3. Update frontend in `public/index.html`

## 🐛 Troubleshooting

### Port already in use
Change PORT in `.env` file

### Database locked error
Close any database viewers and restart server

### Cannot connect to API
Check that server is running on correct port

## 📝 License

MIT License - Free to use and modify

## 👨‍⚕️ About

Built for Dr. Jahnavi's Clinic to modernize patient management and streamline clinic operations.

## 🤝 Support

For issues or questions, please check:
1. README troubleshooting section
2. Server logs for error messages
3. Browser console for frontend errors

## 🔄 Future Enhancements

- SMS notifications for appointments
- WhatsApp integration
- Prescription printing
- Lab report management
- Multi-doctor support
- Advanced analytics dashboard
- Backup and restore functionality

---

**Version:** 1.0.0  
**Last Updated:** February 2024
