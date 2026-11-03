const { query, queryOne, execute } = require('../config/db');

/**
 * GET /api/tasks/my-tasks
 * Member endpoint: Fetch tasks assigned to current logged-in user
 */
exports.getMyTasks = async (req, res) => {
    try {
        const tasks = await query(
            `SELECT * FROM tasks
             WHERE user_id = ?
             ORDER BY completed ASC, created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, count: tasks.length, tasks });
    } catch (error) {
        console.error('getMyTasks error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch your tasks.' });
    }
};

/**
 * PATCH /api/tasks/:id/toggle
 * Member & Admin endpoint: Toggle task completion status
 */
exports.toggleTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }

        // Authorization check: task must belong to user, unless requester is ADMIN
        if (task.user_id !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'You are not authorized to modify this task.' });
        }

        const newCompleted = task.completed === 1 ? 0 : 1;

        await execute(
            `UPDATE tasks
             SET completed = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [newCompleted, id]
        );

        const updated = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
        res.json({
            success: true,
            message: `Task marked as ${newCompleted === 1 ? 'completed' : 'incomplete'}.`,
            task: updated
        });
    } catch (error) {
        console.error('toggleTask error:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle task completion.' });
    }
};

/**
 * POST /api/tasks (Admin only)
 * Assign a new task to a member
 */
exports.createTask = async (req, res) => {
    try {
        const { user_id, title, project_title, due_date } = req.body;

        if (!user_id || !title) {
            return res.status(400).json({
                success: false,
                error: 'user_id and title are required.'
            });
        }

        const user = await queryOne('SELECT id, name FROM users WHERE id = ?', [user_id]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Assigned member not found.' });
        }

        const id = 'tsk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        await execute(
            `INSERT INTO tasks (id, user_id, title, project_title, due_date, completed)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [id, user_id, title.trim(), project_title ? project_title.trim() : null, due_date || null]
        );

        const task = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
        res.status(201).json({ success: true, message: 'Task assigned successfully.', task });
    } catch (error) {
        console.error('createTask error:', error);
        res.status(500).json({ success: false, error: 'Failed to create task.' });
    }
};

/**
 * GET /api/tasks (Admin only)
 * List all tasks across the club with member details
 */
exports.getAllTasks = async (req, res) => {
    try {
        const { user_id, completed } = req.query;
        let sql = `
            SELECT t.*, u.name as member_name, u.email as member_email
            FROM tasks t
            JOIN users u ON t.user_id = u.id
        `;
        const conditions = [];
        const args = [];

        if (user_id) {
            conditions.push('t.user_id = ?');
            args.push(user_id);
        }

        if (completed !== undefined) {
            conditions.push('t.completed = ?');
            args.push(completed === '1' || completed === 'true' ? 1 : 0);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY t.created_at DESC';

        const tasks = await query(sql, args);
        res.json({ success: true, count: tasks.length, tasks });
    } catch (error) {
        console.error('getAllTasks error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch all tasks.' });
    }
};

/**
 * DELETE /api/tasks/:id (Admin only)
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT id FROM tasks WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Task not found.' });
        }

        await execute('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ success: true, message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('deleteTask error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete task.' });
    }
};

