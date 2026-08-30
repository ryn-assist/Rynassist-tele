const { getDb } = require('../database');
const { requirePositiveInteger, requireNonNegativeInteger, requireText, requireProductCode } = require('../utils/validation');

const PRODUCT_SELECT = `SELECT p.*, COUNT(CASE WHEN s.status='available' THEN 1 END) available_stock,
  COUNT(s.id) total_stock FROM products p LEFT JOIN stock_items s ON s.product_id=p.id`;
const ACTIVE_PRODUCT_ORDER = 'p.id ASC';

function listProducts(page = 1, limit = 10, popular = false) {
  const safeLimit = Math.min(requirePositiveInteger(limit, 'Limit'), 10);
  const total = getDb().prepare('SELECT COUNT(*) count FROM products WHERE is_active=1').get().count;
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(requirePositiveInteger(page, 'Halaman'), pages);
  const offset = (safePage - 1) * safeLimit;
  const order = popular ? 'p.sold_count DESC, p.id ASC' : ACTIVE_PRODUCT_ORDER;
  const items = getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${order} LIMIT ? OFFSET ?`).all(safeLimit, offset);
  return { items, total, pages, page: safePage };
}
function getProduct(id) { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.id=? GROUP BY p.id`).get(id); }
function getProductByCode(code) { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.code=? GROUP BY p.id`).get(code); }
function activeProducts() {
  return getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${ACTIVE_PRODUCT_ORDER}`).all();
}
function activeProductCount() {
  return getDb().prepare('SELECT COUNT(*) count FROM products WHERE is_active=1').get().count;
}
function activeProductAt(position) {
  const offset = requirePositiveInteger(position, 'Nomor produk') - 1;
  return getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${ACTIVE_PRODUCT_ORDER} LIMIT 1 OFFSET ?`).get(offset);
}
function activeStockSummary() { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY p.id ASC`).all(); }
function createProduct({ code, name, price, description }) {
  const cleanDescription = String(description ?? '').trim();
  if (cleanDescription.length > 2000) throw new Error('Deskripsi maksimal 2000 karakter.');
  return getDb().prepare('INSERT INTO products(code,name,price,description) VALUES(?,?,?,?)')
    .run(requireProductCode(code), requireText(name, 'Nama produk', 100), requireNonNegativeInteger(price, 'Harga'), cleanDescription).lastInsertRowid;
}
function updateProduct(id, field, value) {
  const productId = requirePositiveInteger(id, 'ID produk');
  const allowed = new Set(['code', 'name', 'description', 'price', 'is_active']);
  if (!allowed.has(field)) throw new Error('Field edit tidak valid.');
  const validators = {
    code: requireProductCode,
    name: (input) => requireText(input, 'Nama produk', 100),
    description: (input) => { const text = String(input ?? '').trim(); if (text.length > 2000) throw new Error('Deskripsi maksimal 2000 karakter.'); return text; },
    price: (input) => requireNonNegativeInteger(input, 'Harga'),
    is_active: (input) => { const active = Number(input); if (![0, 1].includes(active)) throw new Error('is_active hanya boleh 0 atau 1.'); return active; }
  };
  return getDb().prepare(`UPDATE products SET ${field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(validators[field](value), productId);
}
function deleteProduct(id) {
  const productId = requirePositiveInteger(id, 'ID produk');
  const orders = getDb().prepare('SELECT COUNT(*) count FROM orders WHERE product_id=?').get(productId).count;
  if (orders) return updateProduct(productId, 'is_active', 0);
  return getDb().prepare('DELETE FROM products WHERE id=?').run(productId);
}
function addStock(productId, contents) {
  const id = requirePositiveInteger(productId, 'ID produk');
  if (!Array.isArray(contents) || contents.length === 0 || contents.length > 100) throw new Error('Restock harus berisi 1-100 item.');
  const clean = contents.map((content) => requireText(content, 'Item stok', 3000));
  if (new Set(clean).size !== clean.length) throw new Error('Item stok duplikat ditemukan dalam input.');
  return getDb().transaction((rows) => {
    if (!getDb().prepare('SELECT 1 FROM products WHERE id=?').get(id)) throw new Error('Produk tidak ditemukan.');
    const insert = getDb().prepare('INSERT INTO stock_items(product_id,content) VALUES(?,?)');
    const exists = getDb().prepare('SELECT 1 FROM stock_items WHERE product_id=? AND content=?');
    for (const content of rows) {
      if (exists.get(id, content)) throw new Error('Item stok sudah pernah tersimpan untuk produk ini.');
      insert.run(id, content);
    }
    return rows.length;
  }).immediate(clean);
}
function stockSummary() {
  return getDb().prepare(`${PRODUCT_SELECT} GROUP BY p.id ORDER BY p.id`).all();
}
module.exports = { listProducts, activeProducts, activeProductCount, activeProductAt, activeStockSummary, getProduct, getProductByCode, createProduct, updateProduct, deleteProduct, addStock, stockSummary };
