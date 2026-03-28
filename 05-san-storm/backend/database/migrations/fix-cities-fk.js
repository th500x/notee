const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: '05_san_storm' });
  const [fks] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA='05_san_storm' AND TABLE_NAME='cities' AND REFERENCED_TABLE_NAME='factions'`
  );
  console.log('Foreign keys found:', fks.map(f => f.CONSTRAINT_NAME));
  for (const fk of fks) {
    await pool.query(`ALTER TABLE cities DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
    console.log('Dropped:', fk.CONSTRAINT_NAME);
  }
  await pool.end();
  console.log('Done');
})();
