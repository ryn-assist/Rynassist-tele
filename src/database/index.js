const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { config } = require('../config');

let db;
function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  const intentColumns = db.prepare('PRAGMA table_info(purchase_intents)').all();
  if (!intentColumns.some((column) => column.name === 'unit_price')) {
    db.exec('ALTER TABLE purchase_intents ADD COLUMN unit_price INTEGER CHECK (unit_price >= 0)');
  }
  const foreignKeysEnabled = db.pragma('foreign_keys', { simple: true });
  if (foreignKeysEnabled !== 1) throw new Error('SQLite foreign key tidak aktif.');
  return db;
}

function closeDb() { if (db) { db.close(); db = undefined; } }
module.exports = { getDb, closeDb };
