const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'accounts_v4'};`);
    console.log(`Database ${process.env.DB_NAME || 'accounts_v4'} checked/created.`);
    await connection.end();
}

setup().catch(console.error);
