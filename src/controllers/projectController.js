const { del } = require('@vercel/blob');
const { handleUpload } = require('@vercel/blob/client');
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
 * POST /api/projects/upload
 * Dual handler: Generates client upload token for admin OR handles Vercel completion webhook
 */
exports.uploadHandler = async (req, res) => {
    try {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return res.status(503).json({
                success: false,
                error: 'Vercel Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN in .env.'
            });
        }

        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            token: process.env.BLOB_READ_WRITE_TOKEN,
            onBeforeGenerateToken: async (pathname) => {
                return {
                    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maximumSizeInBytes: 5 * 1024 * 1024,
                    tokenPayload: JSON.stringify({ userId: req.user?.id || 'admin' })
                };
            },
            onUploadCompleted: async ({ blob }) => {
                console.log(`[Vercel Blob] Project cover uploaded: ${blob.url}`);
            }
        });

        return res.json(jsonResponse);
    } catch (error) {
        console.error('Project uploadHandler error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
};

exports.getProjects = async (req, res) => {
    try {
        const { category } = req.query;
        let sql = 'SELECT * FROM projects';
        const args = [];

        if (category && (category === 'ongoing' || category === 'past')) {
            sql += ' WHERE category = ?';
            args.push(category);
        }

        sql += ' ORDER BY date DESC';
        const projects = await query(sql, args);
        res.json({ success: true, count: projects.length, projects });
    } catch (error) {
        console.error('getProjects error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch projects.' });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
        res.json({ success: true, project });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch project.' });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { title, description, category, cover_image } = req.body;
        if (!title || !description) {
            return res.status(400).json({ success: false, error: 'Title and description are required.' });
        }

        if (cover_image && !isValidImageUrl(cover_image)) {
            return res.status(400).json({ success: false, error: 'Invalid cover image URL.' });
        }

        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const cat = (category === 'past') ? 'past' : 'ongoing';

        await execute(
            `INSERT INTO projects (id, title, description, category, cover_image, created_by_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, title.trim(), description.trim(), cat, cover_image || null, req.user?.id || null]
        );

        const project = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
        res.status(201).json({ success: true, message: 'Project created successfully.', project });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create project.' });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, cover_image } = req.body;

        const existing = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, error: 'Project not found.' });

        if (cover_image && !isValidImageUrl(cover_image)) {
            return res.status(400).json({ success: false, error: 'Invalid cover image URL.' });
        }

        // If cover_image is replaced and old one was a Vercel Blob, clean up old blob
        if (existing.cover_image && cover_image && existing.cover_image !== cover_image && existing.cover_image.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
            try { await del(existing.cover_image); } catch (e) { /* ignore cleanup error */ }
        }

        await execute(
            `UPDATE projects SET
                title = ?,
                description = ?,
                category = ?,
                cover_image = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
            [
                title !== undefined ? title.trim() : existing.title,
                description !== undefined ? description.trim() : existing.description,
                category || existing.category,
                cover_image !== undefined ? cover_image : existing.cover_image,
                id
            ]
        );

        const updated = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
        res.json({ success: true, message: 'Project updated successfully.', project: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update project.' });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT id, cover_image FROM projects WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, error: 'Project not found.' });

        // Clean up project cover blob if hosted on Vercel Blob
        if (existing.cover_image && existing.cover_image.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
            try { await del(existing.cover_image); } catch (e) { /* ignore cleanup error */ }
        }

        await execute('DELETE FROM projects WHERE id = ?', [id]);
        res.json({ success: true, message: 'Project deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete project.' });
    }
};

