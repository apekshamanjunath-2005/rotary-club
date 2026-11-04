const { query, queryOne, execute } = require('../config/db');

/**
 * GET /api/tasks/my-tasks
 * Member endpoint: Fetch tasks assigned to current logged-in user
 */
exports.getMyTasks = async (req, res) => {
    try {
        const tasks = await query(
            `SELECT t.*,
                    COALESCE(p.title, t.project_title) as project_title,
                    COALESCE(t.project_id, p.id) as project_id
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.user_id = ?
             ORDER BY t.completed ASC, t.created_at DESC`,
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

        const updated = await queryOne(
            `SELECT t.*,
                    COALESCE(p.title, t.project_title) as project_title,
                    COALESCE(t.project_id, p.id) as project_id
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.id = ?`,
            [id]
        );
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
 * Assign a new task to a member linked to a project
 */
exports.createTask = async (req, res) => {
    try {
        const { user_id, project_id, title, due_date } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'user_id is required.'
            });
        }

        if (!project_id && !title) {
            return res.status(400).json({
                success: false,
                error: 'Project selection is mandatory.'
            });
        }

        const user = await queryOne('SELECT id, name FROM users WHERE id = ?', [user_id]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Assigned member not found.' });
        }

        let selectedProjectId = project_id || null;
        let projectTitle = null;

        if (selectedProjectId) {
            const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [selectedProjectId]);
            if (!project) {
                return res.status(404).json({ success: false, error: 'Selected project not found.' });
            }
            projectTitle = project.title;
        }

        // The task title is either explicitly provided or defaults to the selected project's title
        const taskTitle = (title && title.trim()) ? title.trim() : projectTitle;

        const id = 'tsk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        await execute(
            `INSERT INTO tasks (id, user_id, project_id, title, project_title, due_date, completed)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [id, user_id, selectedProjectId, taskTitle, projectTitle, due_date || null]
        );

        const task = await queryOne(
            `SELECT t.*, u.name as member_name, u.email as member_email,
                    COALESCE(p.title, t.project_title) as project_title,
                    COALESCE(t.project_id, p.id) as project_id
             FROM tasks t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.id = ?`,
            [id]
        );
        res.status(201).json({ success: true, message: 'Task assigned successfully.', task });
    } catch (error) {
        console.error('createTask error:', error);
        res.status(500).json({ success: false, error: 'Failed to create task.' });
    }
};

/**
 * GET /api/tasks (Admin only)
 * List all tasks across the club with member and project details
 */
exports.getAllTasks = async (req, res) => {
    try {
        const { user_id, completed } = req.query;
        let sql = `
            SELECT t.*, u.name as member_name, u.email as member_email,
                   COALESCE(p.title, t.project_title) as project_title,
                   COALESCE(t.project_id, p.id) as project_id
            FROM tasks t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN projects p ON t.project_id = p.id
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

