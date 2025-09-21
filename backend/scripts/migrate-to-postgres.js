const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function getMySQLTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'project_eval',
    });

    try {
        // Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        const tableSchemas = {};
        
        // Get schema for each table
        for (const table of tableNames) {
            const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
            const [createTable] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
            
            tableSchemas[table] = {
                columns,
                createStatement: createTable[0]['Create Table']
            };
        }
        
        return tableSchemas;
    } finally {
        await connection.end();
    }
}

async function createPostgresSchema(pgPool, tableSchemas) {
    const client = await pgPool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create tables in PostgreSQL
        for (const [table, schema] of Object.entries(tableSchemas)) {
            // Convert MySQL CREATE TABLE to PostgreSQL syntax (simplified)
            let createStmt = schema.createStatement
                .replace(/\`/g, '"')
                .replace(/int\(\d+\)/g, 'INTEGER')
                .replace(/varchar\((\d+)\)/g, 'VARCHAR($1)')
                .replace(/\bAUTO_INCREMENT\b/gi, 'SERIAL')
                .replace(/\bUNSIGNED\b/gi, '')
                .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
                .replace(/\bTEXT\b/gi, 'TEXT')
                .replace(/,\s*PRIMARY KEY \(`id`\)/, '')
                .replace(/,\s*UNIQUE KEY `[^`]+` \(`[^`]+`\)/g, '')
                .replace(/\bDEFAULT\s+NULL\b/gi, 'DEFAULT NULL')
                .replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b/gi, 'DEFAULT CURRENT_TIMESTAMP')
                .replace(/\bON UPDATE CURRENT_TIMESTAMP\b/gi, '');
                
            // Add primary key separately
            createStmt += ', PRIMARY KEY (id)';
            
            console.log(`Creating table ${table}...`);
            await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
            await client.query(createStmt);
        }
        
        await client.query('COMMIT');
        console.log('Database schema created successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating schema:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function migrateData(pgPool, tableSchemas) {
    const mysqlConn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'project_eval',
    });
    
    const pgClient = await pgPool.connect();
    
    try {
        await pgClient.query('BEGIN');
        
        for (const table of Object.keys(tableSchemas)) {
            console.log(`Migrating data for table ${table}...`);
            
            // Get data from MySQL
            const [rows] = await mysqlConn.query(`SELECT * FROM \`${table}\``);
            
            if (rows.length === 0) {
                console.log(`No data in table ${table}, skipping...`);
                continue;
            }
            
            // Prepare columns and placeholders for INSERT
            const columns = Object.keys(rows[0]).map(col => `"${col}"`).join(', ');
            const placeholders = rows[0] ? Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(', ') : '';
            
            // Insert data into PostgreSQL
            for (const row of rows) {
                const values = Object.values(row);
                const query = {
                    text: `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`,
                    values: values.map(v => v === null ? null : v)
                };
                
                await pgClient.query(query);
            }
            
            console.log(`Migrated ${rows.length} rows to table ${table}`);
        }
        
        await pgClient.query('COMMIT');
        console.log('Data migration completed successfully!');
    } catch (error) {
        await pgClient.query('ROLLBACK');
        console.error('Error during data migration:', error);
        throw error;
    } finally {
        mysqlConn.end();
        pgClient.release();
    }
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL environment variable is not set');
        process.exit(1);
    }
    
    try {
        // Get MySQL schema
        console.log('Reading MySQL schema...');
        const tableSchemas = await getMySQLTables();
        
        // Create PostgreSQL connection pool
        const pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        
        // Create schema in PostgreSQL
        console.log('Creating PostgreSQL schema...');
        await createPostgresSchema(pgPool, tableSchemas);
        
        // Migrate data
        console.log('Migrating data...');
        await migrateData(pgPool, tableSchemas);
        
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
