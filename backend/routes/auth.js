const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { getPool } = require('../models/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/signup',
	body('name').isLength({ min: 2 }),
	body('email').isEmail(),
	body('password').isLength({ min: 6 }),
	body('role').isIn(['admin', 'leader', 'member']).optional(),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const { name, email, password, role } = req.body;
		const pool = getPool();
		const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
		if (rows.length) return res.status(409).json({ message: 'Email already registered' });
		const hashed = await bcrypt.hash(password, 10);
		const userRole = role || 'member';
		const [result] = await pool.query('INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)', [name, email, hashed, userRole]);
		res.status(201).json({ id: result.insertId, name, email, role: userRole });
	}
);

router.post('/login',
	body('email').isEmail(),
	body('password').isLength({ min: 6 }),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const { email, password } = req.body;
		const pool = getPool();
		const [rows] = await pool.query('SELECT id, name, email, password, role, active FROM users WHERE email = ?', [email]);
		if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
		const user = rows[0];
		if (!user.active) return res.status(403).json({ message: 'Account deactivated' });
		const match = await bcrypt.compare(password, user.password);
		if (!match) return res.status(401).json({ message: 'Invalid credentials' });
		const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '1d' });
		res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
		res.json({ id: user.id, role: user.role, name: user.name });
	}
);

router.post('/logout', (req, res) => {
	res.clearCookie('token');
	res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
	const pool = getPool();
	const [rows] = await pool.query('SELECT id, name, email, role, active FROM users WHERE id = ?', [req.user.id]);
	if (!rows.length) return res.status(404).json({ message: 'User not found' });
	res.json(rows[0]);
});

router.put('/me', authenticate,
	body('name').optional().isLength({ min: 2 }),
	body('email').optional().isEmail(),
	body('password').optional().isLength({ min: 6 }),
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		const pool = getPool();
		const fields = [];
		const values = [];
		if (req.body.name !== undefined) { fields.push('name = ?'); values.push(req.body.name); }
		if (req.body.email !== undefined) { fields.push('email = ?'); values.push(req.body.email); }
		if (req.body.password !== undefined) { const hashed = await bcrypt.hash(req.body.password, 10); fields.push('password = ?'); values.push(hashed); }
		if (!fields.length) return res.status(400).json({ message: 'No changes' });
		values.push(req.user.id);
		await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
		res.json({ message: 'Profile updated' });
	}
);

module.exports = router;
