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
 * Helper to intelligently derive Community Project details from a Civic Service Request
 */
function deriveProjectDetails(sr) {
    const loc = (sr.location || 'Honavar').trim();
    const issue = (sr.issue_description || '').trim();
    const lower = issue.toLowerCase();

    let prefix = 'Civic Action';
    if (lower.includes('road') || lower.includes('pothole') || lower.includes('pavement')) {
        prefix = 'Road Repair';
    } else if (lower.includes('water') || lower.includes('pipe') || lower.includes('drain') || lower.includes('drinking')) {
        prefix = 'Water & Sanitation Support';
    } else if (lower.includes('light') || lower.includes('lamp') || lower.includes('street light')) {
        prefix = 'Streetlight Restoration';
    } else if (lower.includes('garbage') || lower.includes('waste') || lower.includes('clean') || lower.includes('trash')) {
        prefix = 'Community Cleanliness Initiative';
    } else if (lower.includes('school') || lower.includes('student') || lower.includes('classroom') || lower.includes('book')) {
        prefix = 'Educational Facility Aid';
    } else if (lower.includes('health') || lower.includes('medical') || lower.includes('clinic') || lower.includes('hospital')) {
        prefix = 'Community Health Relief';
    }

    const title = `${prefix} at ${loc}`;
    const description = `Community project initiated from Civic Service Request (${sr.tracking_code}). ${issue}. Location: ${loc}.`;

    return { title, description };
}

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
            `SELECT sr.tracking_code, sr.location, sr.issue_description, sr.status, sr.admin_notes, sr.created_at, sr.updated_at,
                    p.id as linked_project_id, p.title as linked_project_title, p.category as linked_project_category
             FROM service_requests sr
             LEFT JOIN projects p ON sr.project_id = p.id
             WHERE sr.tracking_code = ?`,
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
        const { status, assigned_to, my_requests } = req.query;
        let sql = `
            SELECT sr.*, u.name as assigned_member_name,
                   p.id as linked_project_id, p.title as linked_project_title, p.category as linked_project_category
            FROM service_requests sr
            LEFT JOIN users u ON sr.assigned_member_id = u.id
            LEFT JOIN projects p ON sr.project_id = p.id
        `;
        const conditions = [];
        const args = [];

        if (status && VALID_STATUSES.includes(status)) {
            conditions.push('sr.status = ?');
            args.push(status);
        }

        if (my_requests === 'true' && req.user) {
            // Fetch requests assigned to member OR submitted by member's email
            conditions.push('(sr.assigned_member_id = ? OR LOWER(sr.submitter_email) = ?)');
            args.push(req.user.id, (req.user.email || '').toLowerCase());
        } else if (assigned_to) {
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
            `SELECT sr.*, u.name as assigned_member_name,
                    p.id as linked_project_id, p.title as linked_project_title, p.category as linked_project_category
             FROM service_requests sr
             LEFT JOIN users u ON sr.assigned_member_id = u.id
             LEFT JOIN projects p ON sr.project_id = p.id
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
 * Admin only: Update workflow status and administrative notes.
 * Automatically generates a linked Community Project when status changes to ACTION_TAKEN.
 */
exports.updateServiceRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        const existing = await queryOne('SELECT * FROM service_requests WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Service request not found.' });
        }

        // Validate status if provided; otherwise retain current status
        let targetStatus = existing.status;
        if (status !== undefined && status !== null && String(status).trim() !== '') {
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
                });
            }
            targetStatus = status;
        } else if (admin_notes === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Status or admin_notes is required.'
            });
        }

        // Handle administrative notes (update or preserve)
        const targetNotes = admin_notes !== undefined ? (admin_notes ? String(admin_notes).trim() : null) : existing.admin_notes;

        let createdProject = null;
        let linkedProjectId = existing.project_id || null;

        // ISSUE 3: Automatically create a project ONLY when status becomes ACTION_TAKEN
        // and a project has not yet been created for this civic request
        if (targetStatus === 'ACTION_TAKEN' && !existing.project_id) {
            const { title: projTitle, description: projDesc } = deriveProjectDetails(existing);
            const newProjId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const adminId = req.user ? req.user.id : null;
            const projDate = new Date().toISOString().split('T')[0];

            await execute(
                `INSERT INTO projects (id, title, description, category, cover_image, date, created_by_id)
                 VALUES (?, ?, ?, 'ongoing', NULL, ?, ?)`,
                [newProjId, projTitle, projDesc, projDate, adminId]
            );

            linkedProjectId = newProjId;
            createdProject = { id: newProjId, title: projTitle, category: 'ongoing' };
        } else if (targetStatus === 'COMPLETED' && existing.project_id) {
            // Keep project status aligned when civic request completes
            await execute(
                `UPDATE projects SET category = 'past', updated_at = datetime('now') WHERE id = ?`,
                [existing.project_id]
            );
        }

        await execute(
            `UPDATE service_requests
             SET status = ?,
                 admin_notes = ?,
                 project_id = ?,
                 updated_at = datetime('now')
             WHERE id = ?`,
            [targetStatus, targetNotes, linkedProjectId, id]
        );

        const updated = await queryOne(
            `SELECT sr.*, u.name as assigned_member_name,
                    p.id as linked_project_id, p.title as linked_project_title, p.category as linked_project_category
             FROM service_requests sr
             LEFT JOIN users u ON sr.assigned_member_id = u.id
             LEFT JOIN projects p ON sr.project_id = p.id
             WHERE sr.id = ?`,
            [id]
        );

        let message = 'Service request updated successfully.';
        if (createdProject) {
            message = `Status updated to ACTION TAKEN. Automatically created linked Community Project: "${createdProject.title}".`;
        }

        res.json({
            success: true,
            message,
            request: updated,
            created_project: createdProject
        });
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
