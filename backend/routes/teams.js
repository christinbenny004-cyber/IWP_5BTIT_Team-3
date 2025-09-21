const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getPool } = require('../models/db');

const router = express.Router();

let teamTableEnsured = false;
async function ensureTeamTable(pool){
    if (teamTableEnsured) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS team_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leader_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_team_member (leader_id, user_id),
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    teamTableEnsured = true;
}

router.use(authenticate, authorize(['leader', 'admin']));

// List team members for current leader (or for admin: pass leaderId query)
router.get('/members', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.query.leaderId || req.user.id) : req.user.id;
    const [rows] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.leader_id = ?
        ORDER BY u.name ASC
    `, [leaderId]);
    res.json(rows);
});

// List available users not yet in leader's team
router.get('/available-users', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.query.leaderId || req.user.id) : req.user.id;
    // Include leaders and members; exclude current user and users already in team
    const [rows] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role
        FROM users u
        WHERE u.active = 1
          AND u.id <> ?
          AND NOT EXISTS (
            SELECT 1 FROM team_members tm WHERE tm.leader_id = ? AND tm.user_id = u.id
          )
        ORDER BY u.name ASC
    `, [leaderId, leaderId]);
    res.json(rows);
});

// Add user to leader's team
router.post('/members', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.body.leaderId || req.user.id) : req.user.id;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: 'user_id is required' });
    try {
        await pool.query('INSERT INTO team_members (leader_id, user_id) VALUES (?, ?)', [leaderId, user_id]);
        res.status(201).json({ message: 'Team member added' });
    } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'User already in team' });
        }
        throw e;
    }
});

// Remove user from leader's team
router.delete('/members/:userId', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.query.leaderId || req.user.id) : req.user.id;
    const { userId } = req.params;
    await pool.query('DELETE FROM team_members WHERE leader_id = ? AND user_id = ?', [leaderId, userId]);
    res.json({ message: 'Team member removed' });
});

// Tasks per member across leader-owned projects
router.get('/member-tasks', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.query.leaderId || req.user.id) : req.user.id;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const [rows] = await pool.query(`
        SELECT t.id, t.task_name, t.description, t.status, m.module_name, p.title AS project_title
        FROM tasks t
        JOIN modules m ON t.module_id = m.id
        JOIN projects p ON m.project_id = p.id
        WHERE p.created_by = ? AND t.assigned_to = ?
        ORDER BY t.id DESC
    `, [leaderId, userId]);
    res.json(rows);
});

// Projects associated with the leader's team (projects created by leader OR where any team member is a project member)
router.get('/projects', async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const leaderId = req.user.role === 'admin' ? (req.query.leaderId || req.user.id) : req.user.id;
    const [rows] = await pool.query(`
        SELECT DISTINCT p.*
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN team_members tm ON tm.user_id = pm.user_id AND tm.leader_id = ?
        WHERE p.created_by = ? OR tm.id IS NOT NULL
        ORDER BY p.created_at DESC
    `, [leaderId, leaderId]);
    res.json(rows);
});

// Admin-only endpoints
// Get all teams in the company
router.get('/admin/all-teams', authenticate, authorize(['admin']), async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    
    // Get all leaders who have teams
    const [leaders] = await pool.query(`
        SELECT DISTINCT u.id, u.name, u.email
        FROM users u
        INNER JOIN team_members tm ON u.id = tm.leader_id
        WHERE u.role = 'leader' AND u.active = 1
        ORDER BY u.name ASC
    `);
    
    // For each leader, get their team members
    const teams = [];
    for (const leader of leaders) {
        const [members] = await pool.query(`
            SELECT u.id, u.name, u.email, u.role
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.leader_id = ? AND u.active = 1
            ORDER BY u.name ASC
        `, [leader.id]);
        
        teams.push({
            leader: {
                id: leader.id,
                name: leader.name,
                email: leader.email
            },
            members: members,
            memberCount: members.length
        });
    }
    
    res.json(teams);
});

// Get team details by leader ID (admin only)
router.get('/admin/team-details/:leaderId', authenticate, authorize(['admin']), async (req, res) => {
    const pool = getPool();
    await ensureTeamTable(pool);
    const { leaderId } = req.params;
    
    // Get leader information
    const [leaderRows] = await pool.query(`
        SELECT id, name, email, role, active
        FROM users
        WHERE id = ? AND role = 'leader'
    `, [leaderId]);
    
    if (!leaderRows.length) {
        return res.status(404).json({ message: 'Leader not found' });
    }
    
    const leader = leaderRows[0];
    
    // Get team members
    const [members] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, tm.created_at as joined_at
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.leader_id = ? AND u.active = 1
        ORDER BY u.name ASC
    `, [leaderId]);
    
    // Get projects associated with this leader's team
    const [projects] = await pool.query(`
        SELECT DISTINCT p.*
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN team_members tm ON tm.user_id = pm.user_id AND tm.leader_id = ?
        WHERE p.created_by = ? OR tm.id IS NOT NULL
        ORDER BY p.created_at DESC
    `, [leaderId, leaderId]);
    
    res.json({
        leader: leader,
        members: members,
        memberCount: members.length,
        projects: projects,
        projectCount: projects.length
    });
});

// Get all available leaders for team assignment (admin only)
router.get('/admin/available-leaders', authenticate, authorize(['admin']), async (req, res) => {
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT id, name, email, role
        FROM users
        WHERE role = 'leader' AND active = 1
        ORDER BY name ASC
    `);
    res.json(rows);
});

module.exports = router;


