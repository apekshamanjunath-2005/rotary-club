const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne, execute, batch } = require('../config/db');
const { MEMBERSHIP_ELIGIBILITY } = require('../config/eligibilityConfig');

const VALID_STATUSES = MEMBERSHIP_ELIGIBILITY.ALLOWED_STATUSES || ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * Helper to generate JWT token for newly registered applicants
 */
const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET || 'rotary_honavar_secret_key_2026_service_above_self',
        { expiresIn: '7d' }
    );
};

/**
 * Validates affirmative task willingness
 * Must be explicitly selected (true, 1, '1', 'yes', 'true')
 */
const isExplicitYes = (val) => {
    if (val === true || val === 1 || val === '1') return true;
    if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        return lower === 'yes' || lower === 'true';
    }
    return false;
};

/**
 * POST /api/memberships/apply
 * Submit a membership application with comprehensive eligibility validation.
 * Supports dual-mode workflow:
 *  - Unauthenticated visitors provide a password to create an applicant account and submit atomically.
 *  - Authenticated users submit using their existing account without password validation or duplicate user check.
 */
exports.apply = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            age,
            profession,
            motivation_message,
            reason_for_joining,
            community_interests,
            skills_experience,
            time_commitment,
            task_willingness,
            service_areas,
            password
        } = req.body;

        // 1. Personal Details Validation
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Full name is required.' });
        }

        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const emailFormatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!cleanEmail || !emailFormatRegex.test(cleanEmail)) {
            return res.status(400).json({ success: false, error: 'A valid email address is required.' });
        }

        // Age validation against configurable eligibility threshold
        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge)) {
            return res.status(400).json({ success: false, error: 'Age must be provided as a valid number.' });
        }
        if (parsedAge < MEMBERSHIP_ELIGIBILITY.MIN_AGE) {
            return res.status(400).json({
                success: false,
                error: `Applicants must be at least ${MEMBERSHIP_ELIGIBILITY.MIN_AGE} years of age to be eligible for club membership.`
            });
        }

        if (!profession || typeof profession !== 'string' || !profession.trim()) {
            return res.status(400).json({ success: false, error: 'Profession or occupation is required.' });
        }

        // 2. Membership Details & Questions Validation
        const reason = (motivation_message || reason_for_joining || '').trim();
        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Please explain why you want to join our Rotary Club.'
            });
        }

        const interests = typeof community_interests === 'string' ? community_interests.trim() : '';
        if (!interests) {
            return res.status(400).json({
                success: false,
                error: 'Please describe what interests you about community service and volunteering.'
            });
        }

        const skills = typeof skills_experience === 'string' ? skills_experience.trim() : '';
        if (!skills) {
            return res.status(400).json({
                success: false,
                error: 'Please describe the skills, experience or knowledge you can contribute to the club.'
            });
        }

        const timeCommitment = typeof time_commitment === 'string' ? time_commitment.trim() : '';
        if (!timeCommitment) {
            return res.status(400).json({
                success: false,
                error: 'Please state how much time you can dedicate to club activities.'
            });
        }

        // Explicit Task Willingness Verification (Must be explicitly affirmative, cannot be missing or defaulted)
        if (!isExplicitYes(task_willingness)) {
            return res.status(400).json({
                success: false,
                error: 'Applicants must agree to accept and complete tasks assigned by the club to be eligible for membership.'
            });
        }

        const serviceAreas = typeof service_areas === 'string' ? service_areas.trim() : '';
        if (!serviceAreas) {
            return res.status(400).json({
                success: false,
                error: 'Please indicate what areas of community service you are interested in.'
            });
        }

        const cleanPhone = (phone && typeof phone === 'string' ? phone.trim() : 'N/A');
        let targetUserId = req.user?.id;
        let token = null;

        // ==================== MODE 1: UNAUTHENTICATED VISITOR ====================
        if (!targetUserId) {
            // Validate password for new account creation
            const minPass = MEMBERSHIP_ELIGIBILITY.MIN_PASSWORD_LENGTH || 6;
            if (!password || typeof password !== 'string' || password.length < minPass) {
                return res.status(400).json({
                    success: false,
                    error: `Password (minimum ${minPass} characters) is required to create your applicant account.`
                });
            }

            // Check if user account already exists with this email
            const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'An account with this email already exists. Please log in first to submit your membership application.'
                });
            }

            // Check if application already exists with this email
            const existingApp = await queryOne('SELECT id, status FROM membership_applications WHERE email = ?', [cleanEmail]);
            if (existingApp) {
                return res.status(400).json({
                    success: false,
                    error: 'A membership application has already been submitted with this email address.'
                });
            }

            targetUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const hashedPassword = await bcrypt.hash(password, 10);
            const applicationId = 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

            // Create user and application atomically via batch()
            await batch([
                {
                    sql: `INSERT INTO users (id, name, email, password, role, phone)
                          VALUES (?, ?, ?, ?, 'PENDING', ?)`,
                    args: [targetUserId, name.trim(), cleanEmail, hashedPassword, cleanPhone]
                },
                {
                    sql: `INSERT INTO membership_applications (
                              id, user_id, name, email, phone, age, profession,
                              motivation_message, community_interests, skills_experience,
                              time_commitment, task_willingness, service_areas, status
                          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'PENDING')`,
                    args: [
                        applicationId,
                        targetUserId,
                        name.trim(),
                        cleanEmail,
                        cleanPhone,
                        parsedAge,
                        profession.trim(),
                        reason,
                        interests,
                        skills,
                        timeCommitment,
                        serviceAreas
                    ]
                }
            ]);

            token = generateToken(targetUserId, 'PENDING');

            return res.status(201).json({
                success: true,
                message: 'Membership application submitted successfully. Your applicant account has been created.',
                token,
                application_id: applicationId
            });
        }

        // ==================== MODE 2: AUTHENTICATED USER ====================
        // Authenticated user submitting using their existing account (no password check, no user email collision rejection)
        const existingApp = await queryOne(
            'SELECT id, status FROM membership_applications WHERE user_id = ? OR email = ?',
            [targetUserId, cleanEmail]
        );

        if (existingApp) {
            return res.status(400).json({
                success: false,
                error: existingApp.status === 'APPROVED'
                    ? 'You are already an active member of the club.'
                    : 'You have already submitted a membership application that is currently under review.'
            });
        }

        const applicationId = 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        await execute(
            `INSERT INTO membership_applications (
                 id, user_id, name, email, phone, age, profession,
                 motivation_message, community_interests, skills_experience,
                 time_commitment, task_willingness, service_areas, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'PENDING')`,
            [
                applicationId,
                targetUserId,
                name.trim(),
                cleanEmail,
                cleanPhone,
                parsedAge,
                profession.trim(),
                reason,
                interests,
                skills,
                timeCommitment,
                serviceAreas
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Membership application submitted successfully.',
            application_id: applicationId
        });

    } catch (error) {
        console.error('apply error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit membership application.' });
    }
};

/**
 * GET /api/memberships (Admin only)
 * List all membership applications, returning full candidate details for review
 */
exports.getApplications = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM membership_applications';
        const args = [];

        if (status && VALID_STATUSES.includes(status)) {
            sql += ' WHERE status = ?';
            args.push(status);
        }

        sql += ' ORDER BY created_at DESC';
        const applications = await query(sql, args);
        res.json({ success: true, count: applications.length, applications });
    } catch (error) {
        console.error('getApplications error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch membership applications.' });
    }
};

/**
 * GET /api/memberships/:id (Admin only)
 * Get single application details
 */
exports.getApplicationById = async (req, res) => {
    try {
        const application = await queryOne('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
        }
        res.json({ success: true, application });
    } catch (error) {
        console.error('getApplicationById error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch application.' });
    }
};

/**
 * PATCH /api/memberships/:id/review (Admin only)
 * Approve or reject application.
 * If approved: atomically promotes user to MEMBER and sets a 1-year membership_end_date inside a single batch() transaction.
 * If rejected: marks application as REJECTED without granting member access.
 */
exports.reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, review_notes } = req.body;

        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status must be either APPROVED or REJECTED.'
            });
        }

        const application = await queryOne('SELECT * FROM membership_applications WHERE id = ?', [id]);
        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
        }

        const statements = [
            {
                sql: `UPDATE membership_applications
                      SET status = ?,
                          review_notes = ?,
                          reviewed_at = datetime('now'),
                          updated_at = datetime('now')
                      WHERE id = ?`,
                args: [status, review_notes || null, id]
            }
        ];

        // When approved, promote user and grant a 1-year active membership term atomically
        if (status === 'APPROVED') {
            statements.push({
                sql: `UPDATE users
                      SET role = 'MEMBER',
                          membership_end_date = date('now', '+1 year'),
                          updated_at = datetime('now')
                      WHERE id = ?`,
                args: [application.user_id]
            });
        }

        await batch(statements);

        const updated = await queryOne('SELECT * FROM membership_applications WHERE id = ?', [id]);
        res.json({
            success: true,
            message: `Application ${status.toLowerCase()} successfully.`,
            application: updated
        });

    } catch (error) {
        console.error('reviewApplication error:', error);
        res.status(500).json({ success: false, error: 'Failed to review application.' });
    }
};

/**
 * GET /api/memberships/active-members (Admin only)
 * Retrieve active Rotarians (role = 'MEMBER' or 'ADMIN') for task and service request assignment.
 * Excludes pending applicants and inactive/rejected accounts.
 */
exports.getActiveMembers = async (req, res) => {
    try {
        const members = await query(
            `SELECT id, name, email, role, phone, membership_end_date
             FROM users
             WHERE role IN ('MEMBER', 'ADMIN') AND is_active = 1
             ORDER BY name ASC`
        );
        res.json({ success: true, count: members.length, members });
    } catch (error) {
        console.error('getActiveMembers error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve active members.' });
    }
};
