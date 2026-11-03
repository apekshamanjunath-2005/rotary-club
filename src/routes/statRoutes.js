const express = require('express');
const router = express.Router();
const statController = require('../controllers/statController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Consistently protected by authMiddleware & adminMiddleware
router.get('/', authMiddleware, adminMiddleware, statController.getAdminStats);

module.exports = router;

