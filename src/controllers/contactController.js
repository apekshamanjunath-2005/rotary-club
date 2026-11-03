const { query, queryOne, execute } = require('../config/db');

const VALID_STATUSES = ['NEW', 'READ', 'REPLIED'];

/**
 * POST /api/contacts
 * Public contact form submission
 */
exports.createContact = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, and message are required.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ success: false, error: 'Invalid email address.' });
        }

        const id = 'cnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        await execute(
            `INSERT INTO contacts (id, name, email, message, status)
             VALUES (?, ?, ?, ?, 'NEW')`,
            [id, name.trim(), email.trim().toLowerCase(), message.trim()]
        );

        res.status(201).json({
            success: true,
            message: 'Thank you for contacting the Rotary Club of Honavar. We will respond shortly.'
        });
    } catch (error) {
        console.error('createContact error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit contact inquiry.' });
    }
};

/**
 * GET /api/contacts (Admin only)
 * Retrieve inquiries with optional status filtering
 */
exports.getContacts = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM contacts';
        const args = [];

        if (status && VALID_STATUSES.includes(status)) {
            sql += ' WHERE status = ?';
            args.push(status);
        }

        sql += ' ORDER BY created_at DESC';
        const contacts = await query(sql, args);
        res.json({ success: true, count: contacts.length, contacts });
    } catch (error) {
        console.error('getContacts error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch contacts.' });
    }
};

/**
 * PATCH /api/contacts/:id/status (Admin only)
 * Mark an inquiry as READ or REPLIED
 */
exports.updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        const existing = await queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Contact inquiry not found.' });
        }

        await execute(
            `UPDATE contacts SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, id]
        );

        const updated = await queryOne('SELECT * FROM contacts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Contact status updated.', contact: updated });
    } catch (error) {
        console.error('updateContactStatus error:', error);
        res.status(500).json({ success: false, error: 'Failed to update contact status.' });
    }
};

/**
 * DELETE /api/contacts/:id (Admin only)
 * Remove a resolved contact message
 */
exports.deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Contact inquiry not found.' });
        }

        await execute('DELETE FROM contacts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Contact inquiry deleted successfully.' });
    } catch (error) {
        console.error('deleteContact error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete contact inquiry.' });
    }
};
