const { del } = require('@vercel/blob');
const { handleUpload } = require('@vercel/blob/client');
const { query, queryOne, execute, batch } = require('../config/db');

/**
 * Strict validator for event image URLs
 */
function isValidEventImageUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') return false;

        // Branch 1: Vercel Blob Storage (Must have approved image extension)
        if (parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
            return /\.(jpe?g|png|webp)$/i.test(parsed.pathname);
        }

        // Branch 2: Seed Image Compatibility (Strictly images.unsplash.com and /photo- path)
        if (parsed.hostname === 'images.unsplash.com') {
            return parsed.pathname.startsWith('/photo-');
        }

        // Reject all other hostnames, IP addresses, and protocols
        return false;
    } catch {
        return false;
    }
}

/**
 * Strict validator for deletion:
 * 1. Must be HTTPS
 * 2. Hostname must strictly end with .public.blob.vercel-storage.com (No Unsplash or external URLs)
 * 3. Pathname must strictly contain '/events/'
 */
function isDeletableEventBlobUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') return false;
        if (!parsed.hostname.endsWith('.public.blob.vercel-storage.com')) return false;
        return parsed.pathname.includes('/events/') || parsed.pathname.startsWith('/events/');
    } catch {
        return false;
    }
}

/**
 * POST /api/events/upload
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
                // Verified as ADMIN by uploadAuthDispatcher
                return {
                    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maximumSizeInBytes: 5 * 1024 * 1024, // Strictly 5MB
                    tokenPayload: JSON.stringify({ userId: req.user?.id || 'admin' })
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log(`[Vercel Blob] Upload verified: ${blob.url}`);
            }
        });

        return res.json(jsonResponse);
    } catch (error) {
        console.error('Vercel Blob uploadHandler error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
};

/**
 * DELETE /api/events/blob
 * Admin Only: Deletes an uncommitted or abandoned event blob from Vercel storage.
 * Body: { url: "https://...public.blob.vercel-storage.com/events/..." }
 */
exports.deleteUnusedBlob = async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !isDeletableEventBlobUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request. Only Vercel Blob URLs under the events/ path can be deleted.'
            });
        }

        // Safeguard: Check both event_photos AND projects tables
        const inEventPhotos = await queryOne(
            'SELECT id FROM event_photos WHERE image_url = ?',
            [url]
        );
        const inProjects = await queryOne(
            'SELECT id FROM projects WHERE cover_image = ?',
            [url]
        );

        if (inEventPhotos || inProjects) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete image: actively referenced in the database.'
            });
        }

        // Safe to delete from Vercel Blob
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            await del(url);
        }

        res.json({
            success: true,
            message: 'Unused event blob deleted successfully from storage.'
        });
    } catch (error) {
        console.error('deleteUnusedBlob error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete blob from storage.' });
    }
};

/**
 * GET /api/events
 * Public: List published events with their photo galleries
 * Supports query: ?category=ongoing or ?category=past
 */
exports.getPublishedEvents = async (req, res) => {
    try {
        const { category } = req.query;
        let sql = 'SELECT * FROM events WHERE is_published = 1';
        const args = [];

        if (category && (category === 'ongoing' || category === 'past')) {
            sql += ' AND category = ?';
            args.push(category);
        }

        sql += ' ORDER BY event_date DESC';
        const events = await query(sql, args);

        for (const evt of events) {
            evt.photos = await query(
                'SELECT id, image_url, caption, order_num FROM event_photos WHERE event_id = ? ORDER BY order_num ASC',
                [evt.id]
            );
        }

        res.json({
            success: true,
            count: events.length,
            events
        });
    } catch (error) {
        console.error('getPublishedEvents error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch events.' });
    }
};

/**
 * GET /api/events/:id
 * Public: Get single published event with photos (Drafts return 404)
 */
exports.getEventById = async (req, res) => {
    try {
        const event = await queryOne(
            'SELECT * FROM events WHERE id = ? AND is_published = 1',
            [req.params.id]
        );

        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'Event not found or not published.'
            });
        }

        event.photos = await query(
            'SELECT id, image_url, caption, order_num FROM event_photos WHERE event_id = ? ORDER BY order_num ASC',
            [event.id]
        );

        res.json({ success: true, event });
    } catch (error) {
        console.error('getEventById error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch event.' });
    }
};

/**
 * GET /api/events/admin/all
 * Admin: List all events (including drafts) with photo counts
 */
exports.getAllEventsAdmin = async (req, res) => {
    try {
        const events = await query('SELECT * FROM events ORDER BY event_date DESC');

        for (const evt of events) {
            evt.photos = await query(
                'SELECT id, image_url, caption, order_num FROM event_photos WHERE event_id = ? ORDER BY order_num ASC',
                [evt.id]
            );
            evt.photo_count = evt.photos.length;
        }

        res.json({ success: true, count: events.length, events });
    } catch (error) {
        console.error('getAllEventsAdmin error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch admin events.' });
    }
};

/**
 * GET /api/events/admin/:id
 * Admin: Get any event by ID (including unpublished drafts)
 */
exports.getAdminEventById = async (req, res) => {
    try {
        const event = await queryOne('SELECT * FROM events WHERE id = ?', [req.params.id]);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }

        event.photos = await query(
            'SELECT id, image_url, caption, order_num FROM event_photos WHERE event_id = ? ORDER BY order_num ASC',
            [event.id]
        );

        res.json({ success: true, event });
    } catch (error) {
        console.error('getAdminEventById error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch event.' });
    }
};

/**
 * POST /api/events
 * Admin: Create event and all gallery photos in a single atomic transaction
 */
exports.createEvent = async (req, res) => {
    try {
        const { title, description, event_date, location, category, status, is_published, photos } = req.body;

        if (!title || !description || !event_date) {
            return res.status(400).json({
                success: false,
                error: 'Title, description, and event date are required.'
            });
        }

        // Validate all photo URLs
        if (Array.isArray(photos)) {
            for (const p of photos) {
                const url = typeof p === 'string' ? p : p?.image_url;
                if (url && !isValidEventImageUrl(url)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid photo URL: "${url}". Only approved Vercel Blob image URLs are allowed.`
                    });
                }
            }
        }

        const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const eventCategory = (category === 'past') ? 'past' : 'ongoing';
        const eventStatus = ['upcoming', 'completed', 'cancelled'].includes(status) ? status : 'upcoming';
        const publishStatus = (is_published === 0 || is_published === false) ? 0 : 1;

        // Build atomic transaction batch
        const statements = [
            {
                sql: `INSERT INTO events (id, title, description, event_date, location, category, status, is_published)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [eventId, title.trim(), description.trim(), event_date, location || null, eventCategory, eventStatus, publishStatus]
            }
        ];

        if (Array.isArray(photos) && photos.length > 0) {
            for (let i = 0; i < photos.length; i++) {
                const photoUrl = typeof photos[i] === 'string' ? photos[i] : photos[i].image_url;
                const caption = (typeof photos[i] === 'object' && photos[i].caption) ? photos[i].caption : null;
                const photoId = 'photo_' + eventId + '_' + i;

                if (photoUrl) {
                    statements.push({
                        sql: `INSERT INTO event_photos (id, event_id, image_url, caption, order_num)
                              VALUES (?, ?, ?, ?, ?)`,
                        args: [photoId, eventId, photoUrl, caption, i]
                    });
                }
            }
        }

        // Execute all statements atomically in a single SQLite transaction
        await batch(statements);

        const createdEvent = await queryOne('SELECT * FROM events WHERE id = ?', [eventId]);
        createdEvent.photos = await query('SELECT * FROM event_photos WHERE event_id = ? ORDER BY order_num ASC', [eventId]);

        res.status(201).json({
            success: true,
            message: 'Event and gallery created atomically.',
            event: createdEvent
        });
    } catch (error) {
        console.error('createEvent error:', error);
        res.status(500).json({ success: false, error: 'Failed to create event. Database rolled back cleanly.' });
    }
};

/**
 * PUT /api/events/:id
 * Admin: Update event details & append new photos
 */
exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, event_date, location, category, status, is_published, photos } = req.body;

        const existing = await queryOne('SELECT * FROM events WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }

        // Validate any new photo URLs
        if (Array.isArray(photos)) {
            for (const p of photos) {
                const url = typeof p === 'string' ? p : p?.image_url;
                if (url && !isValidEventImageUrl(url)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid photo URL: "${url}". Only approved Vercel Blob image URLs are allowed.`
                    });
                }
            }
        }

        const statements = [
            {
                sql: `UPDATE events SET
                        title = ?, description = ?, event_date = ?, location = ?,
                        category = ?, status = ?, is_published = ?, updated_at = datetime('now')
                      WHERE id = ?`,
                args: [
                    title !== undefined ? title.trim() : existing.title,
                    description !== undefined ? description.trim() : existing.description,
                    event_date || existing.event_date,
                    location !== undefined ? location : existing.location,
                    category || existing.category,
                    status || existing.status,
                    is_published !== undefined ? (is_published ? 1 : 0) : existing.is_published,
                    id
                ]
            }
        ];

        if (Array.isArray(photos) && photos.length > 0) {
            const countRow = await queryOne('SELECT count(*) as count FROM event_photos WHERE event_id = ?', [id]);
            let nextOrder = countRow ? countRow.count : 0;

            for (const p of photos) {
                const photoUrl = typeof p === 'string' ? p : p.image_url;
                const caption = typeof p === 'object' ? p.caption : null;
                const photoId = 'photo_' + id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);

                if (photoUrl) {
                    statements.push({
                        sql: `INSERT INTO event_photos (id, event_id, image_url, caption, order_num)
                              VALUES (?, ?, ?, ?, ?)`,
                        args: [photoId, id, photoUrl, caption, nextOrder++]
                    });
                }
            }
        }

        await batch(statements);

        const updatedEvent = await queryOne('SELECT * FROM events WHERE id = ?', [id]);
        updatedEvent.photos = await query('SELECT * FROM event_photos WHERE event_id = ? ORDER BY order_num ASC', [id]);

        res.json({ success: true, message: 'Event updated successfully.', event: updatedEvent });
    } catch (error) {
        console.error('updateEvent error:', error);
        res.status(500).json({ success: false, error: 'Failed to update event.' });
    }
};

/**
 * PATCH /api/events/:id/publish
 * Admin: Toggle publish status
 */
exports.togglePublish = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await queryOne('SELECT id, is_published FROM events WHERE id = ?', [id]);
        if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

        const newStatus = event.is_published === 1 ? 0 : 1;
        await execute('UPDATE events SET is_published = ?, updated_at = datetime("now") WHERE id = ?', [newStatus, id]);

        res.json({
            success: true,
            message: newStatus === 1 ? 'Event published.' : 'Event moved to drafts.',
            is_published: newStatus
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to toggle publish status.' });
    }
};

/**
 * DELETE /api/events/:id/photos/:photoId
 * Admin: Delete single photo from SQLite and Vercel Blob
 */
exports.deletePhoto = async (req, res) => {
    try {
        const { id, photoId } = req.params;
        const photo = await queryOne('SELECT * FROM event_photos WHERE id = ? AND event_id = ?', [photoId, id]);
        if (!photo) return res.status(404).json({ success: false, error: 'Photo not found.' });

        if (photo.image_url.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
            try { await del(photo.image_url); } catch (e) { /* ignore if already removed */ }
        }

        await execute('DELETE FROM event_photos WHERE id = ?', [photoId]);
        res.json({ success: true, message: 'Photo deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete photo.' });
    }
};

/**
 * DELETE /api/events/:id
 * Admin: Delete event and clean up all associated photos from Vercel Blob
 */
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await queryOne('SELECT id FROM events WHERE id = ?', [id]);
        if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

        const photos = await query('SELECT image_url FROM event_photos WHERE event_id = ?', [id]);
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            for (const p of photos) {
                if (p.image_url.includes('blob.vercel-storage.com')) {
                    try { await del(p.image_url); } catch (e) { /* ignore */ }
                }
            }
        }

        await execute('DELETE FROM events WHERE id = ?', [id]);
        res.json({ success: true, message: 'Event and all photos deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete event.' });
    }
};
