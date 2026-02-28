const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const r1 = await pool.query('SELECT key, value FROM "AppConfig" ORDER BY key');
  console.log('=== AppConfig ===');
  r1.rows.forEach(r => console.log('  ' + r.key + ' = ' + r.value));
  
  const r2 = await pool.query('SELECT COUNT(*) as total FROM "AttendanceSession"');
  const r3 = await pool.query('SELECT COUNT(*) as with_addr FROM "AttendanceSession" WHERE address IS NOT NULL');
  console.log('\n=== Attendance Sessions ===');
  console.log('  Total:', r2.rows[0].total);
  console.log('  With address:', r3.rows[0].with_addr);
  
  const r4 = await pool.query('SELECT type, address, timestamp FROM "AttendanceSession" ORDER BY timestamp DESC LIMIT 5');
  console.log('\n=== Latest 5 Sessions ===');
  r4.rows.forEach(r => console.log('  ' + r.type + ' | ' + (r.address || 'no address') + ' | ' + r.timestamp));
  
  await pool.end();
}
main();
