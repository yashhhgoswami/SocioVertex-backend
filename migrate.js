// Simple migration runner: reads files in migrations/ and runs them sequentially
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

(async () => {
  try {
    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir).filter(f => /\.sql$/i.test(f)).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`Applying migration: ${file}`);
      await db.query(sql);
    }
    console.log('All migrations applied.');
    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  }
})();
