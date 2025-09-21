const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testXamppConnection() {
    console.log('🔍 Testing XAMPP MySQL connection...');
    
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mysql'  // Connect to default 'mysql' database first
    };

    console.log('Connection config:', {
        ...config,
        password: config.password ? '*** (password set)' : '(no password)'
    });

    try {
        // Test connection to MySQL server
        const connection = await mysql.createConnection({
            ...config,
            database: 'mysql'  // Connect to default 'mysql' database first
        });

        console.log('✅ Successfully connected to XAMPP MySQL server!');
        
        // Check if our database exists
        const [dbs] = await connection.query('SHOW DATABASES');
        console.log('\n📋 Available databases:');
        dbs.forEach(db => console.log(`- ${db.Database}`));
        
        // Check if our target database exists
        const targetDb = process.env.DB_NAME || 'project_eval';
        const dbExists = dbs.some(db => db.Database === targetDb);
        
        if (dbExists) {
            console.log(`\n✅ Database '${targetDb}' exists!`);
            
            // List tables in our database
            const [tables] = await connection.query(`SHOW TABLES FROM \`${targetDb}\``);
            console.log(`\n📋 Tables in '${targetDb}':`);
            if (tables.length > 0) {
                tables.forEach(table => {
                    console.log(`- ${Object.values(table)[0]}`);
                });
            } else {
                console.log('No tables found in the database.');
            }
        } else {
            console.log(`\n❌ Database '${targetDb}' does not exist.`);
            console.log('   You can create it with: CREATE DATABASE ' + targetDb + ';');
        }
        
        await connection.end();
    } catch (error) {
        console.error('\n❌ Error connecting to XAMPP MySQL:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Is XAMPP Control Panel open?');
            console.log('2. Is MySQL service running in XAMPP? (should be green)');
            console.log('3. Check if port 3306 is being used by another application');
            console.log('4. Try restarting XAMPP if the service fails to start');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Check your MySQL username and password in .env');
            console.log('2. Default XAMPP credentials are usually:');
            console.log('   - User: root');
            console.log('   - Password: (empty)');
        }
    }
}

testXamppConnection();
