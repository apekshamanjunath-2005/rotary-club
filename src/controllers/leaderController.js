const { query, queryOne, execute } = require('../config/db');

/**
 * Validates that an image URL belongs to Vercel Blob or trusted seed host
 */
function isValidImageUrl(urlStr) {
    if (!urlStr) return true; // Optional field
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') return false;
        if (parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
            return /\.(jpe?g|png|webp)$/i.test(parsed.pathname);
        }
        if (parsed.hostname === 'images.unsplash.com') {
            return parsed.pathname.startsWith('/photo-');
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * GET /api/leaders
 * Public endpoint to fetch leadership roster sorted by designated display order
 */
exports.getLeaders = async (req, res) => {
    try {
        const { rotary_year } = req.query;
        let sql = 'SELECT * FROM leaders';
        const args = [];

        if (rotary_year) {
            sql += ' WHERE rotary_year = ?';
            args.push(rotary_year);
        }

        sql += ' ORDER BY order_num ASC, created_at ASC';
        const leaders = await query(sql, args);
        res.json({ success: true, count: leaders.length, leaders });
    } catch (error) {
        console.error('getLeaders error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch leaders.' });
    }
};

/**
 * GET /api/leaders/:id
 * Public endpoint to fetch single leader profile
 */
exports.getLeaderById = async (req, res) => {
    try {
        const leader = await queryOne('SELECT * FROM leaders WHERE id = ?', [req.params.id]);
        if (!leader) {
            return res.status(404).json({ success: false, error: 'Leader profile not found.' });
        }
        res.json({ success: true, leader });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch leader profile.' });
    }
};

/**
 * POST /api/leaders (Admin only)
 * Add a new leader to the roster
 */
exports.createLeader = async (req, res) => {
    try {
        const { name, position, rotary_year, order_num, image } = req.body;
        if (!name || !position || !rotary_year) {
            return res.status(400).json({
                success: false,
                error: 'Name, position, and rotary_year are required.'
            });
        }

        if (image && !isValidImageUrl(image)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid image URL. Must be a valid Vercel Blob or trusted image.'
            });
        }

        const id = 'ldr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const orderValue = Number.isInteger(Number(order_num)) ? Number(order_num) : 0;

        await execute(
            `INSERT INTO leaders (id, name, position, rotary_year, order_num, image)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name.trim(), position.trim(), rotary_year.trim(), orderValue, image || null]
        );

        const leader = await queryOne('SELECT * FROM leaders WHERE id = ?', [id]);
        res.status(201).json({ success: true, message: 'Leader added successfully.', leader });
    } catch (error) {
        console.error('createLeader error:', error);
        res.status(500).json({ success: false, error: 'Failed to add leader.' });
    }
};

/**
 * PUT /api/leaders/:id (Admin only)
 * Update existing leader details
 */
exports.updateLeader = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, position, rotary_year, order_num, image } = req.body;

        const existing = await queryOne('SELECT * FROM leaders WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Leader profile not found.' });
        }

        if (image && !isValidImageUrl(image)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid image URL. Must be a valid Vercel Blob or trusted image.'
            });
        }

        await execute(
            `UPDATE leaders SET
                name = ?,
                position = ?,
                rotary_year = ?,
                order_num = ?,
                image = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
            [
                name !== undefined ? name.trim() : existing.name,
                position !== undefined ? position.trim() : existing.position,
                rotary_year !== undefined ? rotary_year.trim() : existing.rotary_year,
                order_num !== undefined ? Number(order_num) : existing.order_num,
                image !== undefined ? image : existing.image,
                id
            ]
        );

        const updated = await queryOne('SELECT * FROM leaders WHERE id = ?', [id]);
        res.json({ success: true, message: 'Leader profile updated successfully.', leader: updated });
    } catch (error) {
        console.error('updateLeader error:', error);
        res.status(500).json({ success: false, error: 'Failed to update leader profile.' });
    }
};

/**
 * DELETE /api/leaders/:id (Admin only)
 * Remove a leader from the roster
 */
exports.deleteLeader = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT id FROM leaders WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Leader profile not found.' });
        }

        await execute('DELETE FROM leaders WHERE id = ?', [id]);
        res.json({ success: true, message: 'Leader removed successfully.' });
    } catch (error) {
        console.error('deleteLeader error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove leader.' });
    }
};

