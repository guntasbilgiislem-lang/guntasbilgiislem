const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:5432281994xc907@db.idgczlqrrfcfwztfdrjj.supabase.co:5432/postgres'
});

async function check() {
  try {
    await client.connect();
    console.log('Checking branches table for admin:');
    const branches = await client.query("SELECT * FROM branches WHERE id = 'admin'");
    console.log(JSON.stringify(branches.rows, null, 2));

    console.log('\nChecking admins table:');
    const admins = await client.query("SELECT * FROM admins");
    console.log(JSON.stringify(admins.rows, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
