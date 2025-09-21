const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { getPool } = require('../models/db');

const router = express.Router();

router.use(authenticate);

function isAdmin(user) { return user.role === 'admin'; }
function isLeader(user) { return user.role === 'leader'; }

async function canAccessProject(user, projectId) {
	const pool = getPool();
	if (isAdmin(user)) return true;
	if (isLeader(user)) {
		const [rows] = await pool.query('SELECT id FROM projects WHERE id = ? AND created_by = ?', [projectId, user.id]);
		return rows.length > 0;
	}
	const [rows] = await pool.query('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, user.id]);
	return rows.length > 0;
}

async function recomputeProgress(projectId) {
	const pool = getPool();
	const [moduleIds] = await pool.query('SELECT id FROM modules WHERE project_id = ?', [projectId]);
	if (!moduleIds.length) {
		await pool.query('UPDATE projects SET progress = 0 WHERE id = ?', [projectId]);
		return 0;
	}
	let total = 0;
	for (const m of moduleIds) {
		const [tasks] = await pool.query('SELECT status FROM tasks WHERE module_id = ?', [m.id]);
		const completed = tasks.filter(t => t.status === 'completed').length;
		const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
		await pool.query('UPDATE modules SET progress = ? WHERE id = ?', [pct, m.id]);
		total += pct;
	}
	const avg = Math.round(total / moduleIds.length);
	await pool.query('UPDATE projects SET progress = ? WHERE id = ?', [avg, projectId]);
	return avg;
}

router.get('/my-tasks', async (req, res) => {
	const pool = getPool();
	const [rows] = await pool.query(`
		SELECT t.id, t.task_name, t.description, t.status, m.id AS module_id, m.module_name, p.id AS project_id, p.title AS project_title
		FROM tasks t
		JOIN modules m ON t.module_id = m.id
		JOIN projects p ON m.project_id = p.id
		LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
		WHERE (t.assigned_to = ?)
	`, [req.user.id, req.user.id]);
	res.json(rows);
});

// Projects CRUD
router.get('/', async (req, res) => {
	const pool = getPool();
	if (isAdmin(req.user)) {
		const [rows] = await pool.query('SELECT * FROM projects');
		return res.json(rows);
	}
	if (isLeader(req.user)) {
		const [rows] = await pool.query('SELECT * FROM projects WHERE created_by = ?', [req.user.id]);
		return res.json(rows);
	}
	const [rows] = await pool.query('SELECT p.* FROM projects p JOIN project_members pm ON p.id = pm.project_id WHERE pm.user_id = ?', [req.user.id]);
	res.json(rows);
});

router.post('/', authorize(['admin', 'leader']),
	body('title').isLength({ min: 2 }),
	body('status').optional().isIn(['active', 'inactive']),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const pool = getPool();
		const { title, description, start_date, end_date, status } = req.body;
		const [result] = await pool.query('INSERT INTO projects (title, description, start_date, end_date, status, created_by, progress) VALUES (?, ?, ?, ?, ?, ?, 0)', [title, description || '', start_date || null, end_date || null, status || 'active', req.user.id]);
		res.status(201).json({ id: result.insertId });
	}
);

router.put('/:id', async (req, res) => {
	const { id } = req.params;
	if (!(await canAccessProject(req.user, id))) return res.status(403).json({ message: 'Forbidden' });
	const pool = getPool();
	const fields = [];
	const values = [];
	for (const key of ['title', 'description', 'start_date', 'end_date', 'status']) {
		if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
	}
	if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
	values.push(id);
	await pool.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
	res.json({ message: 'Updated' });
});

router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	if (isAdmin(req.user) || (isLeader(req.user) && await canAccessProject(req.user, id))) {
		const pool = getPool();
		await pool.query('DELETE FROM projects WHERE id = ?', [id]);
		return res.json({ message: 'Deleted' });
	}
	return res.status(403).json({ message: 'Forbidden' });
});

// Modules
router.get('/:projectId/modules', async (req, res) => {
	const { projectId } = req.params;
	if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
	const pool = getPool();
	const [rows] = await pool.query('SELECT * FROM modules WHERE project_id = ?', [projectId]);
	res.json(rows);
});

router.post('/:projectId/modules', authorize(['admin', 'leader']),
	body('module_name').isLength({ min: 2 }),
	async (req, res) => {
		const { projectId } = req.params;
		if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
		const pool = getPool();
		const [result] = await pool.query('INSERT INTO modules (project_id, module_name, progress) VALUES (?, ?, 0)', [projectId, req.body.module_name]);
		await recomputeProgress(projectId);
		res.status(201).json({ id: result.insertId });
	}
);

// Tasks
router.get('/modules/:moduleId/tasks', async (req, res) => {
	const { moduleId } = req.params;
	const pool = getPool();
	const [[mod]] = await pool.query('SELECT project_id FROM modules WHERE id = ?', [moduleId]);
	if (!mod) return res.status(404).json({ message: 'Module not found' });
	if (!(await canAccessProject(req.user, mod.project_id))) return res.status(403).json({ message: 'Forbidden' });
	const [rows] = await pool.query('SELECT * FROM tasks WHERE module_id = ?', [moduleId]);
	res.json(rows);
});

router.post('/modules/:moduleId/tasks', authorize(['admin', 'leader']),
	body('task_name').isLength({ min: 2 }),
	body('status').optional().isIn(['pending', 'in-progress', 'completed']),
	async (req, res) => {
		const { moduleId } = req.params;
		const pool = getPool();
		const [[mod]] = await pool.query('SELECT project_id FROM modules WHERE id = ?', [moduleId]);
		if (!mod) return res.status(404).json({ message: 'Module not found' });
		if (!(await canAccessProject(req.user, mod.project_id))) return res.status(403).json({ message: 'Forbidden' });
		const { task_name, description, assigned_to, status } = req.body;
		const [result] = await pool.query('INSERT INTO tasks (module_id, task_name, description, assigned_to, status) VALUES (?, ?, ?, ?, ?)', [moduleId, task_name, description || '', assigned_to || null, status || 'pending']);
		await recomputeProgress(mod.project_id);
		res.status(201).json({ id: result.insertId });
	}
);

router.put('/tasks/:taskId', async (req, res) => {
	const { taskId } = req.params;
	const pool = getPool();
	const [[task]] = await pool.query('SELECT t.*, m.project_id FROM tasks t JOIN modules m ON t.module_id = m.id WHERE t.id = ?', [taskId]);
	if (!task) return res.status(404).json({ message: 'Task not found' });
	// Members can update their own assigned tasks only
	if (req.user.role === 'member' && task.assigned_to !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
	if (!(await canAccessProject(req.user, task.project_id))) return res.status(403).json({ message: 'Forbidden' });
	const fields = [];
	const values = [];
	for (const key of ['task_name', 'description', 'assigned_to', 'status']) {
		if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
	}
	if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
	values.push(taskId);
	await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
	await recomputeProgress(task.project_id);
	res.json({ message: 'Updated' });
});

router.delete('/tasks/:taskId', async (req, res) => {
	const { taskId } = req.params;
	const pool = getPool();
	const [[task]] = await pool.query('SELECT t.*, m.project_id FROM tasks t JOIN modules m ON t.module_id = m.id WHERE t.id = ?', [taskId]);
	if (!task) return res.status(404).json({ message: 'Task not found' });
	if (!(isAdmin(req.user) || (isLeader(req.user) && await canAccessProject(req.user, task.project_id)))) return res.status(403).json({ message: 'Forbidden' });
	await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
	await recomputeProgress(task.project_id);
	res.json({ message: 'Deleted' });
});

// Project members management (leaders/admin)
router.post('/:projectId/members', authorize(['admin', 'leader']),
	body('user_id').isInt(),
	body('role_in_project').optional().isString(),
	async (req, res) => {
		const { projectId } = req.params;
		if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
		const pool = getPool();
		const { user_id, role_in_project } = req.body;
		await pool.query('INSERT INTO project_members (project_id, user_id, role_in_project) VALUES (?, ?, ?)', [projectId, user_id, role_in_project || null]);
		res.status(201).json({ message: 'Member added' });
	}
);

router.delete('/:projectId/members/:userId', authorize(['admin', 'leader']), async (req, res) => {
	const { projectId, userId } = req.params;
	if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
	const pool = getPool();
	await pool.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
	res.json({ message: 'Member removed' });
});

// List project members (leaders/admin)
router.get('/:projectId/members', authorize(['admin', 'leader']), async (req, res) => {
    const { projectId } = req.params;
    if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, pm.role_in_project
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY u.name ASC
    `, [projectId]);
    res.json(rows);
});

// List available members (users with role 'member' not yet in the project)
router.get('/:projectId/available-members', authorize(['admin', 'leader']), async (req, res) => {
    const { projectId } = req.params;
    if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role
        FROM users u
        WHERE u.active = 1
          AND u.id <> ?
          AND u.id NOT IN (SELECT user_id FROM project_members WHERE project_id = ?)
        ORDER BY u.name ASC
    `, [req.user.id, projectId]);
    res.json(rows);
});

// Get tasks for a specific member within a project
router.get('/:projectId/member-tasks', authorize(['admin', 'leader']), async (req, res) => {
    const { projectId } = req.params;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    if (!(await canAccessProject(req.user, projectId))) return res.status(403).json({ message: 'Forbidden' });
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT t.id, t.task_name, t.description, t.status, m.id AS module_id, m.module_name
        FROM tasks t
        JOIN modules m ON t.module_id = m.id
        WHERE m.project_id = ? AND t.assigned_to = ?
        ORDER BY t.id DESC
    `, [projectId, userId]);
    res.json(rows);
});

module.exports = router;
