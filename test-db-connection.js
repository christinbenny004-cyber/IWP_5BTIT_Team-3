const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
    console.log('🔍 Testing MySQL connection...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('User:', process.env.DB_USER || 'root');
    console.log('Database:', process.env.DB_NAME || 'project_eval');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'project_eval',
        });

        console.log('✅ Successfully connected to MySQL database!');
        
        // List all tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log('\n📋 Database tables:');
        tables.forEach(table => {
            console.log(`- ${Object.values(table)[0]}`);
        });

        await connection.end();
    } catch (error) {
        console.error('❌ Error connecting to MySQL:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Is MySQL server running?');
            console.log('2. Check if the host and port are correct');
            console.log('3. Verify your database credentials in .env file');
            console.log('4. Ensure MySQL allows connections from your IP');
        }
    }
}

testConnection();
