const supabase = require('../database');

/**
 * Supabase Auth middleware — replaces custom JWT verify.
 *
 * Reads the Bearer token from Authorization header, validates it with
 * supabase.auth.getUser(), then loads the profile row to get name + role.
 * Sets req.user = { id, role, name, email, patientId (for patients) }
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied - No token provided' });
    }

    // Validate token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Load profile for name + role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return res.status(403).json({ error: 'User profile not found' });
    }

    // For patients, get their patient record id (used for data scoping)
    let patientId = null;
    if (profile.role === 'patient') {
        const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .single();
        patientId = patient ? patient.id : null;
    }

    req.user = {
        id: user.id,
        email: user.email,
        name: profile.name,
        role: profile.role,
        patientId
    };

    next();
};

module.exports = { authenticateToken };
