const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

/**
 * Upload Auth Dispatcher:
 * - If request is Vercel's completion webhook: allow through (handleUpload verifies x-vercel-signature).
 * - If request is a client token generation: enforce admin JWT authentication.
 */
const uploadAuthDispatcher = (req, res, next) => {
    if (req.body?.type === 'blob.upload-completed') {
        return next();
    }
    return authMiddleware(req, res, () => adminMiddleware(req, res, next));
};

// ==========================================
// 1. STATIC & SPECIFIC ROUTES (Declared FIRST)
// ==========================================

// Public list of published events
router.get('/', eventController.getPublishedEvents);

// Admin: List all events including drafts
router.get('/admin/all', authMiddleware, adminMiddleware, eventController.getAllEventsAdmin);

// Admin: Preview specific draft or published event
router.get('/admin/:id', authMiddleware, adminMiddleware, eventController.getAdminEventById);

// Vercel Blob upload endpoint (Client token generation + webhook callback)
router.post('/upload', uploadAuthDispatcher, eventController.uploadHandler);

// Admin: Discard an uncommitted event blob
router.delete('/blob', authMiddleware, adminMiddleware, eventController.deleteUnusedBlob);

// Admin: Create event
router.post('/', authMiddleware, adminMiddleware, eventController.createEvent);

// ==========================================
// 2. SPECIFIC SUB-RESOURCES ON IDS
// ==========================================
router.patch('/:id/publish', authMiddleware, adminMiddleware, eventController.togglePublish);
router.delete('/:id/photos/:photoId', authMiddleware, adminMiddleware, eventController.deletePhoto);
router.put('/:id', authMiddleware, adminMiddleware, eventController.updateEvent);
router.delete('/:id', authMiddleware, adminMiddleware, eventController.deleteEvent);

// ==========================================
// 3. PARAMETERIZED ROUTE (Declared LAST)
// ==========================================
// Public: Fetch a single published event (drafts return 404)
router.get('/:id', eventController.getEventById);

module.exports = router;
