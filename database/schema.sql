CREATE DATABASE IF NOT EXISTS project_eval;
USE project_eval;

CREATE TABLE IF NOT EXISTS users (
	id INT AUTO_INCREMENT PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	email VARCHAR(150) NOT NULL UNIQUE,
	password VARCHAR(255) NOT NULL,
	role ENUM('admin','leader','member') NOT NULL DEFAULT 'member',
	active TINYINT(1) NOT NULL DEFAULT 1,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
	id INT AUTO_INCREMENT PRIMARY KEY,
	title VARCHAR(200) NOT NULL,
	description TEXT,
	start_date DATE NULL,
	end_date DATE NULL,
	status ENUM('active','inactive') NOT NULL DEFAULT 'active',
	created_by INT NOT NULL,
	progress INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modules (
	id INT AUTO_INCREMENT PRIMARY KEY,
	project_id INT NOT NULL,
	module_name VARCHAR(200) NOT NULL,
	progress INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
	id INT AUTO_INCREMENT PRIMARY KEY,
	module_id INT NOT NULL,
	task_name VARCHAR(200) NOT NULL,
	description TEXT,
	assigned_to INT NULL,
	status ENUM('pending','in-progress','completed') NOT NULL DEFAULT 'pending',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
	FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_members (
	id INT AUTO_INCREMENT PRIMARY KEY,
	project_id INT NOT NULL,
	user_id INT NOT NULL,
	role_in_project VARCHAR(100) NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY uniq_member (project_id, user_id),
	FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Independent leader-managed teams
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    leader_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_team_member (leader_id, user_id),
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);