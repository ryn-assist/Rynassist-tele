const crypto = require('node:crypto');
const { getDb } = require('../database');
const { requirePositiveInteger, requireNonNegativeInteger, requireText, requireProductCode } = require('../utils/validation');

const PRODUCT_SELECT = `SELECT p.*,
  COUNT(CASE WHEN s.status='available' AND v.is_active=1 THEN 1 END) available_stock,
  COUNT(CASE WHEN s.status='sold' THEN 1 END) sold_stock,
  COUNT(CASE WHEN v.is_active=1 THEN s.id END) total_stock
  FROM products p LEFT JOIN product_variants v ON v.product_id=p.id
  LEFT JOIN stock_items s ON s.variant_id=v.id`;
const ACTIVE_PRODUCT_ORDER = 'p.name COLLATE NOCASE ASC, p.id ASC';
function listProducts(page = 1, limit = 10, popular = false) {
  const safeLimit = Math.min(requirePositiveInteger(limit, 'Limit'), 10);
  const total = getDb().prepare('SELECT COUNT(*) count FROM products WHERE is_active=1').get().count;
  const pages = Math.max(1, Math.ceil(total / safeLimit)); const safePage = Math.min(requirePositiveInteger(page, 'Halaman'), pages);
  const order = popular ? 'p.sold_count DESC, p.name COLLATE NOCASE ASC, p.id ASC' : ACTIVE_PRODUCT_ORDER;
  const items = getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${order} LIMIT ? OFFSET ?`).all(safeLimit, (safePage - 1) * safeLimit);
  return { items, total, pages, page: safePage };
}
function getProduct(id) { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.id=? GROUP BY p.id`).get(id); }
function getProductByCode(code) { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.code=? GROUP BY p.id`).get(code); }
function activeProducts() { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${ACTIVE_PRODUCT_ORDER}`).all(); }
function activeProductCount() { return getDb().prepare('SELECT COUNT(*) count FROM products WHERE is_active=1').get().count; }
function activeProductAt(position) { return getDb().prepare(`${PRODUCT_SELECT} WHERE p.is_active=1 GROUP BY p.id ORDER BY ${ACTIVE_PRODUCT_ORDER} LIMIT 1 OFFSET ?`).get(requirePositiveInteger(position, 'Nomor produk') - 1); }
function activeStockSummary() { return activeProducts(); }
function createProduct({ code, name, price, description }) {
  const cleanName = requireText(name, 'Nama produk', 100); const cleanPrice = requireNonNegativeInteger(price, 'Harga');
  const cleanDescription = String(description ?? '').trim(); if (cleanDescription.length > 2000) throw new Error('Deskripsi maksimal 2000 karakter.');
  return getDb().transaction(() => { const productCode=requireProductCode(code); const id = getDb().prepare('INSERT INTO products(code,name,price,description) VALUES(?,?,?,?)').run(productCode, cleanName, cleanPrice, cleanDescription).lastInsertRowid; getDb().prepare('INSERT INTO product_variants(product_id,name,code,price,description) VALUES(?,?,?,?,?)').run(id, cleanName, `${productCode}-DEFAULT`, cleanPrice, cleanDescription); return id; }).immediate();
}
function categoryCode(category) {
  return String(category).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'PRODUCT';
}
function addProductVariant({ code, category, name, price, description }) {
  const variantCode = requireProductCode(code);
  const categoryName = requireText(category, 'Kategori', 100);
  const variantName = requireText(name, 'Nama', 100);
  const variantPrice = requireNonNegativeInteger(price, 'Harga');
  const desc = requireText(description || '-', 'Deskripsi', 2000);
  return getDb().transaction(() => {
    let product = getDb().prepare('SELECT * FROM products WHERE lower(trim(name))=lower(trim(?)) LIMIT 1').get(categoryName);
    let createdProduct = false;
    if (!product) {
      const base = categoryCode(categoryName);
      let productCode = base;
      let n = 1;
      while (getDb().prepare('SELECT 1 FROM products WHERE code=? COLLATE NOCASE').get(productCode)) productCode = `${base.slice(0,34)}-${++n}`;
      const productId = getDb().prepare('INSERT INTO products(code,name,price,description) VALUES(?,?,?,?)').run(productCode, categoryName, variantPrice, desc).lastInsertRowid;
      product = getDb().prepare('SELECT * FROM products WHERE id=?').get(productId);
      createdProduct = true;
    }
    if (getDb().prepare('SELECT 1 FROM product_variants WHERE code=? COLLATE NOCASE').get(variantCode)) throw new Error('Kode produk/variasi sudah digunakan.');
    const variantId = getDb().prepare('INSERT INTO product_variants(product_id,name,code,price,description) VALUES(?,?,?,?,?)').run(product.id, variantName, variantCode, variantPrice, desc).lastInsertRowid;
    if (!createdProduct && (!product.description || product.description === '-')) getDb().prepare('UPDATE products SET description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(desc, product.id);
    return { productId: product.id, variantId, createdProduct };
  }).immediate();
}
function updateProduct(id, field, value) {
  const productId = requirePositiveInteger(id, 'ID produk'); const allowed = new Set(['code', 'name', 'description', 'price', 'is_active']); if (!allowed.has(field)) throw new Error('Field edit tidak valid.');
  const validators = { code: requireProductCode, name: (v) => requireText(v, 'Nama produk', 100), description: (v) => { const t=String(v??'').trim(); if(t.length>2000) throw new Error('Deskripsi maksimal 2000 karakter.'); return t; }, price: (v) => requireNonNegativeInteger(v, 'Harga'), is_active: (v) => { const n=Number(v); if(![0,1].includes(n)) throw new Error('is_active hanya boleh 0 atau 1.'); return n; } };
  return getDb().prepare(`UPDATE products SET ${field}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(validators[field](value), productId);
}
function deleteProduct(id) { return updateProduct(id, 'is_active', 0); }
function listVariants(productId, activeOnly = false) { return getDb().prepare(`SELECT v.*,COUNT(CASE WHEN s.status='available' THEN 1 END) available_stock,COUNT(CASE WHEN s.status='sold' THEN 1 END) sold_stock,COUNT(s.id) total_stock FROM product_variants v LEFT JOIN stock_items s ON s.variant_id=v.id WHERE v.product_id=? ${activeOnly?'AND v.is_active=1':''} GROUP BY v.id ORDER BY v.id`).all(requirePositiveInteger(productId,'ID produk')); }
function getVariant(id, activeOnly = false) { return getDb().prepare(`SELECT v.*,p.name product_name,p.code product_code,p.is_active product_active,COUNT(CASE WHEN s.status='available' THEN 1 END) available_stock,COUNT(CASE WHEN s.status='sold' THEN 1 END) sold_stock,COUNT(s.id) total_stock FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN stock_items s ON s.variant_id=v.id WHERE v.id=? ${activeOnly?'AND v.is_active=1 AND p.is_active=1':''} GROUP BY v.id`).get(requirePositiveInteger(id,'ID varian')); }
function createVariant(productId, name, price, code, description='') { const id=requirePositiveInteger(productId,'ID produk'); const product=getDb().prepare('SELECT code FROM products WHERE id=?').get(id); if(!product) throw new Error('Produk tidak ditemukan.'); const cleanCode=requireProductCode(code||`${product.code}-${crypto.randomBytes(4).toString('hex')}`); return getDb().prepare('INSERT INTO product_variants(product_id,name,code,price,description) VALUES(?,?,?,?,?)').run(id,requireText(name,'Nama varian',100),cleanCode,requireNonNegativeInteger(price,'Harga'),requireText(description||'-','Deskripsi',2000)).lastInsertRowid; }
function updateVariant(id, field, value) { const variantId=requirePositiveInteger(id,'ID varian'); const validators={name:(v)=>requireText(v,'Nama varian',100),code:requireProductCode,description:(v)=>requireText(v,'Deskripsi',2000),price:(v)=>requireNonNegativeInteger(v,'Harga'),is_active:(v)=>{const n=Number(v);if(![0,1].includes(n))throw new Error('is_active hanya boleh 0 atau 1.');return n;}}; if(!validators[field]) throw new Error('Field varian hanya name, code, description, price, atau is_active.'); return getDb().prepare(`UPDATE product_variants SET ${field}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(validators[field](value),variantId); }
function deleteVariant(id) { return updateVariant(id,'is_active',0); }
function addVariantStock(variantId, contents) { const variant=getVariant(variantId); if(!variant) throw new Error('Varian tidak ditemukan.'); if(!Array.isArray(contents)||!contents.length||contents.length>100) throw new Error('Restock harus berisi 1-100 item.'); const clean=contents.map(v=>requireText(v,'Item stok',3000)); return getDb().transaction(()=>{const insert=getDb().prepare('INSERT INTO stock_items(product_id,variant_id,content) VALUES(?,?,?)'); for(const content of clean)insert.run(variant.product_id,variant.id,content);return clean.length;}).immediate(); }
function addStock(productId, contents) { const variants=listVariants(productId,true); if(variants.length!==1) throw new Error('Produk memiliki beberapa varian; gunakan /restockvariant VARIANT_ID.'); return addVariantStock(variants[0].id,contents); }
function stockSummary(){return getDb().prepare(`${PRODUCT_SELECT} GROUP BY p.id ORDER BY p.name COLLATE NOCASE ASC, p.id ASC`).all();}
module.exports={listProducts,activeProducts,activeProductCount,activeProductAt,activeStockSummary,getProduct,getProductByCode,createProduct,addProductVariant,updateProduct,deleteProduct,listVariants,getVariant,createVariant,updateVariant,deleteVariant,addVariantStock,addStock,stockSummary};
