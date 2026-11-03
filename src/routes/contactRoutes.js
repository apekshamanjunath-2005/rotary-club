const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Public route
router.post('/', contactController.createContact);

// Admin-only management routes
router.get('/', authMiddleware, adminMiddleware, contactController.getContacts);
router.patch('/:id/status', authMiddleware, adminMiddleware, contactController.updateContactStatus);
router.delete('/:id', authMiddleware, adminMiddleware, contactController.deleteContact);

module.exports = router;
