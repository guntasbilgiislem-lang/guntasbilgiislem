const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:5432281994xc907@db.idgczlqrrfcfwztfdrjj.supabase.co:5432/postgres'
});

async function initDb() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');

    // Create Branches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        music TEXT DEFAULT 'Güntaş Radyo',
        sync TEXT DEFAULT '-',
        volume INT DEFAULT 50
      );
    `);
    console.log('Branches table ready.');

    // Create Campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'audio',
        frequency TEXT,
        status TEXT DEFAULT 'active'
      );
    `);
    console.log('Campaigns table ready.');

    // Create Playlist table
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duration TEXT DEFAULT '3:00',
        file_path TEXT,
        order_index INT DEFAULT 0
      );
    `);
    console.log('Playlist table ready.');

    // Create Admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name TEXT DEFAULT 'Merkez Yönetim'
      );
    `);
    console.log('Admins table ready.');

    // Insert dummy data if empty
    const { rows: branchCount } = await client.query('SELECT COUNT(*) FROM branches');
    if (branchCount[0].count === '0') {
      await client.query(`
        INSERT INTO branches (id, name, password, status, music, sync, volume) VALUES 
        ('gun001', 'Trabzon Meydan', 'meydan001', 'online', 'Güntaş Radyo', 'Az önce', 75),
        ('gun002', 'Akçaabat', 'akcaabat002', 'online', 'Özel Liste', '5 dk önce', 60);
      `);
      await client.query(`
        INSERT INTO campaigns (id, name, type, frequency, status) VALUES 
        ('c1', 'Hafta Sonu İndirimi', 'audio', '30 Dakikada bir', 'active');
      `);
      await client.query(`
        INSERT INTO playlist (id, name, duration) VALUES 
        ('m1', 'Sezen Aksu - Gülümse', '4:30'),
        ('m2', 'Tarkan - Yolla', '3:45');
      `);
      console.log('Dummy data inserted.');
    }

    const { rows: adminCount } = await client.query('SELECT COUNT(*) FROM admins');
    if (adminCount[0].count === '0') {
      await client.query(`
        INSERT INTO admins (username, password, name) VALUES ('admin', 'admin', 'Merkez Yönetim');
      `);
      console.log('Default admin created.');
    }

  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    await client.end();
  }
}

initDb();
