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
  migrateVariants(db);
  const intentColumns = db.prepare('PRAGMA table_info(purchase_intents)').all();
  if (!intentColumns.some((column) => column.name === 'unit_price')) db.exec('ALTER TABLE purchase_intents ADD COLUMN unit_price INTEGER CHECK (unit_price >= 0)');
  const foreignKeysEnabled = db.pragma('foreign_keys', { simple: true });
  if (foreignKeysEnabled !== 1) throw new Error('SQLite foreign key tidak aktif.');
  return db;
}
function hasColumn(database, table, column) { return database.prepare(`PRAGMA table_info(${table})`).all().some((entry) => entry.name === column); }
function migrateVariants(database) {
  for (const table of ['stock_items', 'orders', 'purchase_intents']) if (!hasColumn(database, table, 'variant_id')) database.exec(`ALTER TABLE ${table} ADD COLUMN variant_id INTEGER REFERENCES product_variants(id)`);
  const additions = {
    product_variants: [['code', 'TEXT'], ['description', "TEXT NOT NULL DEFAULT ''"], ['post_purchase_message', 'TEXT']],
    purchase_intents: [['note', 'TEXT']],
    orders: [['variant_name', 'TEXT'], ['product_name', 'TEXT'], ['note', 'TEXT'], ['provider_reference', 'TEXT'], ['payment_status', "TEXT NOT NULL DEFAULT 'paid'"], ['fulfilled_at', 'TEXT']]
  };
  for (const [table, columns] of Object.entries(additions)) for (const [column, definition] of columns) if (!hasColumn(database, table, column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  database.transaction(() => {
    const insert = database.prepare('INSERT INTO product_variants(product_id,name,price) VALUES(?,?,?)');
    for (const product of database.prepare('SELECT id,name,price FROM products WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=products.id)').all()) insert.run(product.id, product.name, product.price);
    database.exec(`UPDATE stock_items SET variant_id=(SELECT id FROM product_variants WHERE product_id=stock_items.product_id ORDER BY id LIMIT 1) WHERE variant_id IS NULL`);
    database.exec(`UPDATE orders SET variant_id=(SELECT id FROM product_variants WHERE product_id=orders.product_id ORDER BY id LIMIT 1) WHERE variant_id IS NULL`);
    database.exec(`UPDATE purchase_intents SET variant_id=(SELECT id FROM product_variants WHERE product_id=purchase_intents.product_id ORDER BY id LIMIT 1) WHERE variant_id IS NULL`);
    database.exec(`UPDATE product_variants SET code='VAR-'||id WHERE code IS NULL OR trim(code)=''`);
    database.exec(`UPDATE product_variants SET description=COALESCE((SELECT description FROM products WHERE products.id=product_variants.product_id),'') WHERE description=''`);
    database.exec(`UPDATE orders SET product_name=COALESCE(product_name,(SELECT name FROM products WHERE products.id=orders.product_id)),variant_name=COALESCE(variant_name,(SELECT name FROM product_variants WHERE product_variants.id=orders.variant_id)),payment_status=CASE WHEN status='paid' THEN 'paid' ELSE status END WHERE product_name IS NULL OR variant_name IS NULL OR payment_status IS NULL`);
  }).immediate();
  database.exec('CREATE INDEX IF NOT EXISTS idx_stock_variant_status ON stock_items(variant_id,status,id)');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_code ON product_variants(code COLLATE NOCASE) WHERE code IS NOT NULL');
}
function closeDb() { if (db) { db.close(); db = undefined; } }
module.exports = { getDb, closeDb };
