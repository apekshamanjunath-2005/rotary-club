const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authMiddleware, adminMiddleware, memberMiddleware } = require('../middleware/authMiddleware');

// Static member route placed FIRST to avoid route precedence collision
router.get('/my-tasks', authMiddleware, memberMiddleware, taskController.getMyTasks);
router.patch('/:id/toggle', authMiddleware, memberMiddleware, taskController.toggleTask);

// Admin-only task management routes
router.post('/', authMiddleware, adminMiddleware, taskController.createTask);
router.get('/', authMiddleware, adminMiddleware, taskController.getAllTasks);
router.delete('/:id', authMiddleware, adminMiddleware, taskController.deleteTask);

module.exports = router;

