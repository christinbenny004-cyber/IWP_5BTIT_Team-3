console.log('Simple test script running...');
console.log('Node.js version:', process.version);
console.log('Current directory:', process.cwd());

// Simple database connection test
const mysql = require('mysql2/promise');

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'mysql'  // Connect to default 'mysql' database
    });
    
    console.log('✅ Successfully connected to MySQL!');
    const [rows] = await connection.query('SELECT 1+1 as result');
    console.log('Test query result:', rows[0].result);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
  }
}

test();
