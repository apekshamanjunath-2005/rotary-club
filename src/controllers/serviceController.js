const { query, queryOne, execute } = require('../config/db');
const { generateTrackingCode } = require('../utils/codeGenerator');

const VALID_STATUSES = ['NEW', 'UNDER_REVIEW', 'ACTION_TAKEN', 'COMPLETED', 'REJECTED'];

/**
 * POST /api/service-requests
 * Public submission of civic service request ("Report a Need")
 */
exports.createServiceRequest = async (req, res) => {
    try {
        const { submitter_name, submitter_email, submitter_phone, location, issue_description } = req.body;

        if (!submitter_name || !submitter_email || !location || !issue_description) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, location, and issue description are required.'
            });
        }

        // Basic email syntax check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitter_email.trim())) {
            return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }

        const id = 'sr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        
        // Generate unique tracking code with collision safeguard
        let trackingCode;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
            trackingCode = generateTrackingCode();
            const existing = await queryOne('SELECT id FROM service_requests WHERE tracking_code = ?', [trackingCode]);
            if (!existing) isUnique = true;
            attempts++;
        }

        if (!isUnique) {
            trackingCode = `HON-SR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        }

        await execute(
            `INSERT INTO service_requests (id, tracking_code, submitter_name, submitter_email, submitter_phone, location, issue_description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW')`,
            [
                id,
                trackingCode,
                submitter_name.trim(),
                submitter_email.trim().toLowerCase(),
                submitter_phone ? submitter_phone.trim() : null,
                location.trim(),
                issue_description.trim()
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Your service request has been submitted successfully.',
            tracking_code: trackingCode,
            status: 'NEW'
        });

    } catch (error) {
        console.error('createServiceRequest error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit service request.' });
    }
};

/**
 * GET /api/service-requests/track/:code
 * Public tracking endpoint: Sanitizes output to preserve submitter privacy
 */
exports.trackServiceRequest = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ success: false, error: 'Tracking code is required.' });
        }

        const request = await queryOne(
            `SELECT tracking_code, location, issue_description, status, admin_notes, created_at, updated_at
             FROM service_requests
             WHERE tracking_code = ?`,
            [code.trim().toUpperCase()]
        );

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'No service request found matching this tracking code.'
            });
        }

        res.json({ success: true, request });
    } catch (error) {
        console.error('trackServiceRequest error:', error);
        res.status(500).json({ success: false, error: 'Failed to look up tracking code.' });
    }
};

/**
 * GET /api/service-requests
 * Admin & Member endpoint: List all requests with optional status and assignment filtering
 */
exports.getAllServiceRequests = async (req, res) => {
    try {
        const { status, assigned_to } = req.query;
        let sql = `
            SELECT sr.*, u.name as assigned_member_name
            FROM service_requests sr
            LEFT JOIN users u ON sr.assigned_member_id = u.id
        `;
        const conditions = [];
        const args = [];

        if (status && VALID_STATUSES.includes(status)) {
            conditions.push('sr.status = ?');
            args.push(status);
        }

        if (assigned_to) {
            conditions.push('sr.assigned_member_id = ?');
            args.push(assigned_to);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY sr.created_at DESC';

        const requests = await query(sql, args);
        res.json({ success: true, count: requests.length, requests });
    } catch (error) {
        console.error('getAllServiceRequests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch service requests.' });
    }
};

/**
 * GET /api/service-requests/:id
 * Admin & Member endpoint: Detailed view of a single request
 */
exports.getServiceRequestById = async (req, res) => {
    try {
        const request = await queryOne(
            `SELECT sr.*, u.name as assigned_member_name
             FROM service_requests sr
             LEFT JOIN users u ON sr.assigned_member_id = u.id
             WHERE sr.id = ?`,
            [req.params.id]
        );

        if (!request) {
            return res.status(404).json({ success: false, error: 'Service request not found.' });
        }

        res.json({ success: true, request });
    } catch (error) {
        console.error('getServiceRequestById error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch service request.' });
    }
};

/**
 * PATCH /api/service-requests/:id/status
 * Admin only: Update workflow status and internal progress notes
 */
exports.updateServiceRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        const existing = await queryOne('SELECT id FROM service_requests WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Service request not found.' });
        }

        await execute(
            `UPDATE service_requests
             SET status = ?,
                 admin_notes = COALESCE(?, admin_notes),
                 updated_at = datetime('now')
             WHERE id = ?`,
            [status, admin_notes !== undefined ? admin_notes : null, id]
        );

        const updated = await queryOne('SELECT * FROM service_requests WHERE id = ?', [id]);
        res.json({ success: true, message: 'Status updated successfully.', request: updated });
    } catch (error) {
        console.error('updateServiceRequestStatus error:', error);
        res.status(500).json({ success: false, error: 'Failed to update request status.' });
    }
};

/**
 * PATCH /api/service-requests/:id/assign
 * Admin only: Assign request to a Rotarian member
 */
exports.assignServiceRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_member_id } = req.body;

        const existing = await queryOne('SELECT id FROM service_requests WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Service request not found.' });
        }

        // Verify assigned user exists if provided
        if (assigned_member_id) {
            const user = await queryOne('SELECT id, name FROM users WHERE id = ?', [assigned_member_id]);
            if (!user) {
                return res.status(400).json({ success: false, error: 'Selected member not found.' });
            }
        }

        await execute(
            `UPDATE service_requests
             SET assigned_member_id = ?,
                 updated_at = datetime('now')
             WHERE id = ?`,
            [assigned_member_id || null, id]
        );

        const updated = await queryOne('SELECT * FROM service_requests WHERE id = ?', [id]);
        res.json({ success: true, message: 'Member assignment updated successfully.', request: updated });
    } catch (error) {
        console.error('assignServiceRequest error:', error);
        res.status(500).json({ success: false, error: 'Failed to assign service request.' });
    }
};
