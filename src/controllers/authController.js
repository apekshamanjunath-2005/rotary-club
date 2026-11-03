const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, execute } = require('../config/db');

/**
 * Generate signed JWT token
 */
const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET || 'rotary_honavar_secret_key_2026_service_above_self',
        { expiresIn: '7d' }
    );
};

/**
 * POST /api/auth/login
 * Authenticate admin or member credentials
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide both email and password.'
            });
        }

        // Find user by email
        const user = await queryOne(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase().trim()]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        if (user.is_active !== 1) {
            return res.status(403).json({
                success: false,
                error: 'Your account is deactivated. Please contact the club secretary.'
            });
        }

        // Verify bcrypt password hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        // Generate token
        const token = generateToken(user.id, user.role);

        // Fetch user's membership application if any
        const application = await queryOne(
            'SELECT id, status, review_notes, reviewed_at, created_at FROM membership_applications WHERE user_id = ? ORDER BY created_at DESC',
            [user.id]
        ) || await queryOne(
            'SELECT id, status, review_notes, reviewed_at, created_at FROM membership_applications WHERE email = ? ORDER BY created_at DESC',
            [user.email]
        );

        const appStatus = application?.status ? application.status.toUpperCase() : null;

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                membership_end_date: user.membership_end_date,
                created_at: user.created_at,
                application_status: appStatus,
                review_notes: application?.review_notes || null,
                application: application ? {
                    id: application.id,
                    status: appStatus,
                    review_notes: application.review_notes || null,
                    reviewed_at: application.reviewed_at || null,
                    created_at: application.created_at || null
                } : null
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during login.'
        });
    }
};

/**
 * POST /api/auth/register
 * Register a new member / applicant (default role: PENDING)
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, and password are required.'
            });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Check if email already exists
        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Email is already registered. Please log in.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        await execute(
            `INSERT INTO users (id, name, email, password, role, phone)
             VALUES (?, ?, ?, ?, 'PENDING', ?)`,
            [userId, name.trim(), cleanEmail, hashedPassword, phone || null]
        );

        const token = generateToken(userId, 'PENDING');

        res.status(201).json({
            success: true,
            message: 'Registration successful. Application pending board review.',
            token,
            user: {
                id: userId,
                name: name.trim(),
                email: cleanEmail,
                role: 'PENDING',
                application_status: 'PENDING',
                application: null
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during registration.'
        });
    }
};

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
exports.getMe = async (req, res) => {
    try {
        // req.user is already populated by authMiddleware
        const user = await queryOne(
            'SELECT id, name, email, role, phone, membership_end_date, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // Fetch user's membership application if any
        const application = await queryOne(
            'SELECT id, status, review_notes, reviewed_at, created_at FROM membership_applications WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        ) || await queryOne(
            'SELECT id, status, review_notes, reviewed_at, created_at FROM membership_applications WHERE email = ? ORDER BY created_at DESC',
            [user.email]
        );

        const appStatus = application?.status ? application.status.toUpperCase() : null;

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                membership_end_date: user.membership_end_date,
                created_at: user.created_at,
                application_status: appStatus,
                review_notes: application?.review_notes || null,
                application: application ? {
                    id: application.id,
                    status: appStatus,
                    review_notes: application.review_notes || null,
                    reviewed_at: application.reviewed_at || null,
                    created_at: application.created_at || null
                } : null
            }
        });
    } catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve profile.'
        });
    }
};

