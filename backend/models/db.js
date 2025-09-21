const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
const { parse } = require('pg-connection-string');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

let pool;

async function initDb() {
    if (pool) return pool;

    // For Railway's PostgreSQL service
    if (process.env.DATABASE_URL) {
        const config = parse(process.env.DATABASE_URL);
        pool = new Pool({
            user: config.user,
            password: config.password,
            host: config.host,
            port: config.port,
            database: config.database,
            ssl: {
                rejectUnauthorized: false
            }
        });
    } else {
        // Local MySQL development
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'project_eval',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            multipleStatements: true,
        });
    }
	// Test connection
	try {
		if (process.env.DATABASE_URL) {
			// PostgreSQL
			const client = await pool.connect();
			console.log('Connected to PostgreSQL database');
			client.release();
		} else {
			// MySQL
			const conn = await pool.getConnection();
			await conn.ping();
			conn.release();
			console.log('Connected to MySQL database');
		}
		return pool;
	} catch (error) {
		console.error('Database connection error:', error);
		throw error;
	}
}

function getPool() {
	if (!pool) {
		throw new Error('Database not initialized. Call initDb() first.');
	}
	return pool;
}

// Add query function that works with both PostgreSQL and MySQL
async function query(sql, params = []) {
    if (process.env.DATABASE_URL) {
        // PostgreSQL
        const client = await pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            client.release();
        }
    } else {
        // MySQL
        const [rows] = await pool.query(sql, params);
        return rows;
    }
}

module.exports = { initDb, getPool, query };
