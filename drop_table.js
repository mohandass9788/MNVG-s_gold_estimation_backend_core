const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'mnv_groups_gold_estimation'
    });

    try {
        console.log('Connected to MySQL');

        // Disable foreign key checks so we can drop tables safely
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        const [rows] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'mnv_groups_gold_estimation';
    `);

        for (const row of rows) {
            const tableName = row['table_name'] || row['TABLE_NAME'];
            console.log(`Dropping table ${tableName}...`);
            await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('All tables dropped successfully.');
    } catch (e) {
        console.error('Error dropping tables:', e);
    } finally {
        await connection.end();
    }
}

main();
