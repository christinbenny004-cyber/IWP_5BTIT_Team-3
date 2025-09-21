const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function checkCompatibility() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'project_eval',
    });

    try {
        console.log('🔍 Checking database compatibility with PostgreSQL...\n');
        
        // 1. Check for MySQL-specific column types
        console.log('📋 Checking for MySQL-specific column types...');
        const [tables] = await connection.query('SHOW TABLES');
        
        for (const table of tables) {
            const tableName = Object.values(table)[0];
            const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
            
            const problematicColumns = columns.filter(col => {
                const type = col.Type.toLowerCase();
                return (
                    type.includes('int(') ||
                    type.includes('tinyint(1)') ||
                    type.includes('datetime') ||
                    type.includes('unsigned') ||
                    type.includes('enum(')
                );
            });
            
            if (problematicColumns.length > 0) {
                console.log(`\n⚠️  Table: ${tableName}`);
                problematicColumns.forEach(col => {
                    console.log(`   - Column: ${col.Field}, Type: ${col.Type}`);
                    if (col.Type.toLowerCase().includes('enum(')) {
                        console.log('     ❗ ENUM type should be converted to CHECK constraint in PostgreSQL');
                    }
                    if (col.Type.toLowerCase().includes('tinyint(1)')) {
                        console.log('     ❗ TINYINT(1) should be converted to BOOLEAN in PostgreSQL');
                    }
                    if (col.Type.toLowerCase().includes('unsigned')) {
                        console.log('     ❗ UNSIGNED attribute not supported in PostgreSQL');
                    }
                });
            }
        }
        
        // 2. Check for MySQL-specific functions in stored procedures and triggers
        console.log('\n🔍 Checking for MySQL-specific functions...');
        const [routines] = await connection.query(`
            SELECT ROUTINE_NAME, ROUTINE_DEFINITION 
            FROM information_schema.ROUTINES 
            WHERE ROUTINE_SCHEMA = ?
        `, [process.env.DB_NAME || 'project_eval']);
        
        const mysqlSpecificFunctions = [
            'GROUP_CONCAT', 'FIND_IN_SET', 'DATE_FORMAT', 'NOW()',
            'IFNULL', 'ISNULL', 'CONVERT_TZ', 'LAST_INSERT_ID'
        ];
        
        routines.forEach(routine => {
            const definition = routine.ROUTINE_DEFINITION;
            const foundFunctions = mysqlSpecificFunctions.filter(func => 
                definition.includes(func)
            );
            
            if (foundFunctions.length > 0) {
                console.log(`\n⚠️  Routine: ${routine.ROUTINE_NAME}`);
                foundFunctions.forEach(func => {
                    console.log(`   - Uses MySQL function: ${func}`);
                    if (func === 'GROUP_CONCAT') {
                        console.log('     ➡️  Replace with STRING_AGG in PostgreSQL');
                    } else if (func === 'FIND_IN_SET') {
                        console.log('     ➡️  Replace with string_to_array and ANY in PostgreSQL');
                    } else if (func === 'DATE_FORMAT') {
                        console.log('     ➡️  Replace with to_char in PostgreSQL');
                    } else if (func === 'NOW()') {
                        console.log('     ➡️  Replace with CURRENT_TIMESTAMP in PostgreSQL');
                    }
                });
            }
        });
        
        // 3. Check for SQL queries in your codebase
        console.log('\n🔍 Checking application code for potential issues...');
        const codePatterns = [
            { pattern: /LIMIT\s+\d+\s*,\s*\d+/g, description: 'MySQL LIMIT offset,count syntax' },
            { pattern: /`[^`]+`/g, description: 'Backticks for identifiers' },
            { pattern: /INSERT\s+INTO.*?VALUES\s*\([^)]*\)\s+ON\s+DUPLICATE\s+KEY\s+UPDATE/gi, 
              description: 'ON DUPLICATE KEY UPDATE syntax' },
            { pattern: /REPLACE\s+INTO/gi, description: 'REPLACE INTO syntax' },
            { pattern: /\bAUTO_INCREMENT\b/gi, description: 'AUTO_INCREMENT keyword' },
        ];
        
        // Check specific route files for MySQL-specific queries
        const routeFiles = [
            path.join(__dirname, '..', 'routes', 'projects.js'),
            path.join(__dirname, '..', 'routes', 'teams.js'),
            path.join(__dirname, '..', 'routes', 'users.js'),
            path.join(__dirname, '..', 'routes', 'auth.js')
        ];
        
        for (const file of routeFiles) {
            try {
                const fs = require('fs');
                const content = fs.readFileSync(file, 'utf8');
                
                codePatterns.forEach(({ pattern, description }) => {
                    if (pattern.test(content)) {
                        console.log(`\n⚠️  File: ${path.basename(file)}`);
                        console.log(`   - Contains: ${description}`);
                        
                        if (description.includes('LIMIT')) {
                            console.log('     ➡️  Change to: LIMIT count OFFSET offset');
                        }
                        if (description.includes('Backticks')) {
                            console.log('     ➡️  Use double quotes for PostgreSQL');
                        }
                        if (description.includes('ON DUPLICATE')) {
                            console.log('     ➡️  Use ON CONFLICT ... DO UPDATE in PostgreSQL');
                        }
                        if (description.includes('REPLACE INTO')) {
                            console.log('     ➡️  Use INSERT ... ON CONFLICT ... DO UPDATE in PostgreSQL');
                        }
                        if (description.includes('AUTO_INCREMENT')) {
                            console.log('     ➡️  Use SERIAL or IDENTITY in PostgreSQL');
                        }
                    }
                });
            } catch (err) {
                // File not found, skip
            }
        }
        
        console.log('\n✅ Compatibility check completed. Review the warnings above before migration.');
        
    } catch (error) {
        console.error('Error during compatibility check:', error);
    } finally {
        await connection.end();
        process.exit(0);
    }
}

checkCompatibility();
