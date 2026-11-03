const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
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

// Vercel Blob upload endpoint for project cover images
router.post('/upload', uploadAuthDispatcher, projectController.uploadHandler);

// Public routes
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);

// Admin-only management routes
router.post('/', authMiddleware, adminMiddleware, projectController.createProject);
router.put('/:id', authMiddleware, adminMiddleware, projectController.updateProject);
router.delete('/:id', authMiddleware, adminMiddleware, projectController.deleteProject);

module.exports = router;

