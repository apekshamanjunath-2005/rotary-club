const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authMiddleware, adminMiddleware, memberMiddleware } = require('../middleware/authMiddleware');

// Public endpoints (Declared first to avoid route precedence conflict)
router.post('/', serviceController.createServiceRequest);
router.post('/upload', serviceController.uploadHandler);
router.post('/upload-direct', serviceController.uploadDirect);
router.get('/track/:code', serviceController.trackServiceRequest);

// Protected endpoints (Admin & Active Members can inspect list & details)
router.get('/', authMiddleware, memberMiddleware, serviceController.getAllServiceRequests);
router.get('/:id', authMiddleware, memberMiddleware, serviceController.getServiceRequestById);

// Admin-only mutation endpoints
router.patch('/:id/status', authMiddleware, adminMiddleware, serviceController.updateServiceRequestStatus);
router.patch('/:id/assign', authMiddleware, adminMiddleware, serviceController.assignServiceRequest);
router.delete('/:id', authMiddleware, adminMiddleware, serviceController.deleteServiceRequest);

module.exports = router;
