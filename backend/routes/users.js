const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { getPool } = require('../models/db');

const router = express.Router();

router.use(authenticate, authorize(['admin']));

router.get('/', async (req, res) => {
	const pool = getPool();
	const [rows] = await pool.query('SELECT id, name, email, role, active FROM users');
	res.json(rows);
});

router.post('/',
	body('name').isLength({ min: 2 }),
	body('email').isEmail(),
	body('password').isLength({ min: 6 }),
	body('role').isIn(['admin', 'leader', 'member']),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const { name, email, password, role } = req.body;
		const bcrypt = require('bcrypt');
		const hashed = await bcrypt.hash(password, 10);
		const pool = getPool();
		const [result] = await pool.query('INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)', [name, email, hashed, role]);
		res.status(201).json({ id: result.insertId, name, email, role, active: 1 });
	}
);

router.put('/:id',
	body('name').optional().isLength({ min: 2 }),
	body('email').optional().isEmail(),
	body('role').optional().isIn(['admin', 'leader', 'member']),
	body('active').optional().isIn([0, 1]),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const pool = getPool();
		const { id } = req.params;
		const fields = [];
		const values = [];
		for (const key of ['name', 'email', 'role', 'active']) {
			if (req.body[key] !== undefined) {
				fields.push(`${key} = ?`);
				values.push(req.body[key]);
			}
		}
		if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
		values.push(id);
		await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
		res.json({ message: 'Updated' });
	}
);

router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	const pool = getPool();
	await pool.query('DELETE FROM users WHERE id = ?', [id]);
	res.json({ message: 'Deleted' });
});

module.exports = router;
