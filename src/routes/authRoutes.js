const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public endpoints
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected endpoint (Requires valid JWT)
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;

