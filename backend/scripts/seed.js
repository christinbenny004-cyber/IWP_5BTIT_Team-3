const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { initDb, getPool } = require('../models/db');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function upsertUser(pool, { name, email, role }) {
	const passwordHash = await bcrypt.hash('password123', 10);
	await pool.query(
		`INSERT INTO users (name, email, password, role, active)
		 VALUES (?, ?, ?, ?, 1)
		 ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), active = 1`,
		[name, email, passwordHash, role]
	);
	const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
	return rows[0].id;
}

async function createProjectWithData(pool, { leaderId, title, description, status }, members = []) {
	const [res] = await pool.query(
		'INSERT INTO projects (title, description, start_date, end_date, status, created_by, progress) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, 0)',
		[title, description, status, leaderId]
	);
	const projectId = res.insertId;
	for (const memberId of members) {
		await pool.query(
			'INSERT IGNORE INTO project_members (project_id, user_id, role_in_project) VALUES (?, ?, ?)',
			[projectId, memberId, 'member']
		);
	}
	// Create modules and tasks
	const modules = ['Planning', 'Development', 'Testing'];
	for (const moduleName of modules) {
		const [mres] = await pool.query('INSERT INTO modules (project_id, module_name, progress) VALUES (?, ?, 0)', [projectId, moduleName]);
		const moduleId = mres.insertId;
		const tasks = [
			{ name: 'Task A', status: 'completed' },
			{ name: 'Task B', status: 'in-progress' },
			{ name: 'Task C', status: 'pending' },
		];
		for (const t of tasks) {
			await pool.query(
				'INSERT INTO tasks (module_id, task_name, description, assigned_to, status) VALUES (?, ?, ?, ?, ?)',
				[moduleId, t.name, `${t.name} for ${moduleName}`, members[0] || null, t.status]
			);
		}
	}
	return projectId;
}

async function run() {
	await initDb();
	const pool = getPool();

	// Users
	const adminId = await upsertUser(pool, { name: 'Alice Admin', email: 'admin@example.com', role: 'admin' });
	const leader1Id = await upsertUser(pool, { name: 'Leo Leader', email: 'leader1@example.com', role: 'leader' });
	const leader2Id = await upsertUser(pool, { name: 'Lara Leader', email: 'leader2@example.com', role: 'leader' });
	const member1Id = await upsertUser(pool, { name: 'Mia Member', email: 'member1@example.com', role: 'member' });
	const member2Id = await upsertUser(pool, { name: 'Max Member', email: 'member2@example.com', role: 'member' });

	// Projects
	await createProjectWithData(pool, { leaderId: leader1Id, title: 'Website Revamp', description: 'Revamp the corporate website', status: 'active' }, [member1Id, member2Id]);
	await createProjectWithData(pool, { leaderId: leader1Id, title: 'Mobile App', description: 'New mobile application', status: 'active' }, [member1Id]);
	await createProjectWithData(pool, { leaderId: leader2Id, title: 'Backend API', description: 'Create REST API', status: 'inactive' }, [member2Id]);

	console.log('Seed completed. Users: admin@example.com, leader1@example.com, leader2@example.com, member1@example.com, member2@example.com (password: password123)');
	process.exit(0);
}

run().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
