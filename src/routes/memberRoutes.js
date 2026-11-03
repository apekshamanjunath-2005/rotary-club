const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Optional auth helper: attaches user if token is valid, otherwise continues unauthenticated
const optionalAuth = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return next();
    authMiddleware(req, res, (err) => {
        // If token failed or expired, continue without user rather than blocking public submission
        next();
    });
};

// Application submission (Public or Logged-in member)
router.post('/apply', optionalAuth, memberController.apply);

// Active members list for assignment (Admin only - declared before /:id)
router.get('/active-members', authMiddleware, adminMiddleware, memberController.getActiveMembers);

// Admin-only application review
router.get('/', authMiddleware, adminMiddleware, memberController.getApplications);
router.get('/:id', authMiddleware, adminMiddleware, memberController.getApplicationById);
router.patch('/:id/review', authMiddleware, adminMiddleware, memberController.reviewApplication);

module.exports = router;

