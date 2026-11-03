const express = require('express');
const router = express.Router();
const leaderController = require('../controllers/leaderController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Public routes
router.get('/', leaderController.getLeaders);
router.get('/:id', leaderController.getLeaderById);

// Admin-only management routes
router.post('/', authMiddleware, adminMiddleware, leaderController.createLeader);
router.put('/:id', authMiddleware, adminMiddleware, leaderController.updateLeader);
router.delete('/:id', authMiddleware, adminMiddleware, leaderController.deleteLeader);

module.exports = router;

