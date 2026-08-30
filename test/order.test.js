const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.BOT_TOKEN = 'test-token-not-a-real-secret';
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rynassist-')), 'test.db');

const { getDb, closeDb } = require('../src/database');
const products = require('../src/services/productService');
const users = require('../src/services/userService');
const orders = require('../src/services/orderService');
const restock = require('../src/services/restockService');
const payments = require('../src/services/paymentService');
const { numberRows } = require('../src/keyboards/main');
const { productListKeyboard, variantKeyboard } = require('../src/keyboards/product');
const { listText } = require('../src/handlers/productHandler');

function createUser(id, balance = 0) {
  users.upsertUser({ id, first_name: 'Test' });
  if (balance) users.adjustBalance(id, balance, 'test');
}

test('saldo order atomik, mengirim stok unik, dan intent hanya sekali pakai', () => {
  createUser(123, 50000);
  const id = products.createProduct({ code: 'ORDER_OK', name: 'Test', price: 10000, description: '' });
  products.addStock(id, ['A', 'B']);
  const token = orders.createIntent(123, id, 2);
  const result = orders.fulfillBalanceIntent(token, 123);

  assert.deepEqual(result.stocks.map((stock) => stock.content), ['A', 'B']);
  assert.equal(users.getUser(123).balance, 30000);
  assert.equal(products.getProduct(id).available_stock, 0);
  assert.throws(() => orders.fulfillBalanceIntent(token, 123), /tidak valid/);
  assert.equal(getDb().prepare('SELECT COUNT(*) count FROM order_items').get().count, 2);
  assert.equal(getDb().prepare("SELECT COUNT(*) count FROM stock_items WHERE status='sold'").get().count, 2);
});

test('semua mutasi order rollback bila penandaan salah satu stok gagal', () => {
  createUser(124, 50000);
  const id = products.createProduct({ code: 'ROLLBACK', name: 'Rollback', price: 10000, description: '' });
  products.addStock(id, ['ROLLBACK-A', 'ROLLBACK-B']);
  const blockedId = getDb().prepare("SELECT id FROM stock_items WHERE product_id=? AND content='ROLLBACK-B'").get(id).id;
  getDb().exec(`CREATE TRIGGER fail_second_stock BEFORE UPDATE OF status ON stock_items WHEN OLD.id=${blockedId} BEGIN SELECT RAISE(ABORT, 'simulated stock failure'); END`);
  const token = orders.createIntent(124, id, 2);

  assert.throws(() => orders.fulfillBalanceIntent(token, 124), /simulated stock failure/);
  assert.equal(users.getUser(124).balance, 50000);
  assert.equal(getDb().prepare('SELECT COUNT(*) count FROM orders WHERE user_id=124').get().count, 0);
  assert.equal(getDb().prepare("SELECT COUNT(*) count FROM stock_items WHERE product_id=? AND status='available'").get(id).count, 2);
  assert.equal(getDb().prepare('SELECT status FROM purchase_intents WHERE token=?').get(token).status, 'pending');
  getDb().exec('DROP TRIGGER fail_second_stock');
});

test('intent menolak quantity dan produk yang tidak valid', () => {
  createUser(125, 50000);
  const id = products.createProduct({ code: 'VALIDATE', name: 'Validate', price: 1000, description: '' });
  products.addStock(id, ['ONLY']);
  for (const invalid of [0, -1, NaN, 1.5, Infinity]) assert.throws(() => orders.createIntent(125, id, invalid), /Quantity/);
  assert.throws(() => orders.createIntent(125, id, 2), /melebihi stok/);
  products.updateProduct(id, 'is_active', 0);
  assert.throws(() => orders.createIntent(125, id, 1), /tidak aktif/);
});

test('restock menerima setiap item duplikat sebagai unit dan subscription tetap unik', () => {
  createUser(126);
  const id = products.createProduct({ code: 'RESTOCK', name: 'Restock', price: 1000, description: '' });
  products.addStock(id, ['SAMA', 'SAMA', 'SAMA']);
  assert.equal(products.getProduct(id).available_stock, 3);
  createUser(226, 5000);
  const first=orders.fulfillBalanceIntent(orders.createIntent(226,id,1),226);
  const second=orders.fulfillBalanceIntent(orders.createIntent(226,id,1),226);
  assert.equal(first.stocks[0].content,'SAMA'); assert.equal(second.stocks[0].content,'SAMA');
  assert.equal(products.getProduct(id).available_stock, 1);
  assert.equal(restock.toggle(126, id), true);
  assert.equal(getDb().prepare('SELECT COUNT(*) count FROM restock_subscriptions WHERE user_id=126 AND product_id=?').get(id).count, 1);
  assert.equal(restock.toggle(126, id), false);
  assert.equal(getDb().prepare('SELECT COUNT(*) count FROM restock_subscriptions WHERE user_id=126 AND product_id=?').get(id).count, 0);
});

test('pagination diklem ke halaman valid dan foreign key aktif', () => {
  assert.equal(getDb().pragma('foreign_keys', { simple: true }), 1);
  assert.equal(products.listProducts(999, 10).page, products.listProducts(1, 10).pages);
  assert.throws(() => products.listProducts(0, 10), /Halaman/);
  assert.throws(() => getDb().prepare("INSERT INTO stock_items(product_id,content) VALUES(999999,'orphan')").run(), /FOREIGN KEY/);
});

test('urutan produk aktif, teks pagination, dan keyboard angka selalu dinamis', () => {
  const first = products.createProduct({ code: 'DYNAMIC_1', name: 'Produk <Satu>', price: 1000, description: '' });
  const removed = products.createProduct({ code: 'DYNAMIC_2', name: 'Produk Dua', price: 1000, description: '' });
  const third = products.createProduct({ code: 'DYNAMIC_3', name: 'Produk Tiga', price: 1000, description: '' });
  products.addStock(first, ['DYNAMIC-STOCK']);

  const before = products.activeProducts();
  assert.equal(products.activeProductAt(before.findIndex((product) => product.id === third) + 1).id, third);
  products.updateProduct(removed, 'is_active', 0);
  const after = products.activeProducts();
  const thirdPosition = after.findIndex((product) => product.id === third) + 1;
  assert.equal(products.activeProductAt(thirdPosition).id, third);
  assert.equal(products.activeProductAt(after.length + 1), undefined);

  assert.deepEqual(numberRows(12), [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '10'], ['11', '12']]);
  const result = products.listProducts(1, 10);
  assert.match(listText(result), /LIST PRODUCT/);
  assert.match(listText(result), /Produk &lt;Satu&gt; \( 1 \)/);
  const buttons = productListKeyboard(result).reply_markup.inline_keyboard;
  assert.ok(buttons.flat().every((button) => !/^\d+\./.test(button.text)));
  if (result.pages > 1) assert.deepEqual(buttons[0].map((button) => button.text), ['➡️ Selanjutnya']);
});

test('produk multi-varian menjumlahkan stok aktif dan order tidak mencampur stok', () => {
  createUser(127, 10000);
  const productId = products.createProduct({ code: 'CANVA', name: 'CANVA', price: 100, description: 'Canva premium' });
  const legacy = products.listVariants(productId)[0];
  products.updateVariant(legacy.id, 'name', 'Canva Mem 1B');
  const designId = products.createVariant(productId, 'Canva Design 1B', 250);
  const eduId = products.createVariant(productId, 'Canva Edu 1B', 500);
  products.addVariantStock(legacy.id, ['MEM-A', 'MEM-B']);
  products.addVariantStock(designId, ['DESIGN-A']);
  products.addVariantStock(eduId, ['EDU-A']);

  assert.equal(products.getProduct(productId).available_stock, 4);
  products.updateVariant(eduId, 'is_active', 0);
  assert.equal(products.getProduct(productId).available_stock, 3);
  const choices = variantKeyboard(127, products.listVariants(productId, true)).reply_markup.inline_keyboard.flat();
  assert.ok(choices.some((button) => /Canva Design 1B/.test(button.text) && /^variant:/.test(button.callback_data)));

  const token = orders.createIntent(127, productId, 1, 'balance', designId);
  const result = orders.fulfillBalanceIntent(token, 127);
  assert.equal(result.variant.id, designId);
  assert.deepEqual(result.stocks.map((stock) => stock.content), ['DESIGN-A']);
  assert.equal(products.getVariant(legacy.id).available_stock, 2);
  assert.equal(getDb().prepare('SELECT variant_id FROM orders WHERE id=?').get(result.orderId).variant_id, designId);
});

test('produk API lama otomatis mempunyai default variant yang kompatibel', () => {
  const productId = products.createProduct({ code: 'LEGACY_API', name: 'Produk Lama', price: 1234, description: '' });
  const variants = products.listVariants(productId, true);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].price, 1234);
  products.addStock(productId, ['LEGACY-STOCK']);
  assert.equal(products.getVariant(variants[0].id).available_stock, 1);
});


test('harga dikalkulasi ulang saat konfirmasi saldo dan saldo kurang tidak mengambil stok', () => {
  createUser(130, 5000); createUser(131, 50);
  const id=products.createProduct({code:'REPRICE',name:'Reprice',price:100,description:''});
  products.addStock(id,['R1','R2']); const variant=products.listVariants(id,true)[0];
  const token=orders.createIntent(130,id,1); products.updateVariant(variant.id,'price',750);
  const result=orders.fulfillBalanceIntent(token,130); assert.equal(result.total,750);
  const poor=orders.createIntent(131,id,1); assert.throws(()=>orders.fulfillBalanceIntent(poor,131),/Saldo/);
  assert.equal(products.getVariant(variant.id).available_stock,1);
});

test('payment pending tidak konsumsi stok, nominal benar, paid idempotent, dan terisolasi antar varian', async () => {
  createUser(132); const id=products.createProduct({code:'PAYMENT',name:'Payment',price:300,description:''});
  const a=products.listVariants(id,true)[0], b=products.createVariant(id,'B',900,'PAY-B','B desc');
  products.addVariantStock(a.id,['A-SAME']); products.addVariantStock(b,['B-ONLY']);
  const token=orders.createIntent(132,id,1,'pakasir',a.id); let received;
  const provider={name:'pakasir',async createPayment(input){received=input;return{reference:input.reference,qrString:'mock-qr',raw:{mock:true}};}};
  const created=await payments.createPayment(token,132,provider); assert.equal(received.amount,300);
  assert.equal(products.getVariant(a.id).available_stock,1);
  const paid=payments.fulfillVerified(created.reference,{status:'paid',amount:300});
  assert.deepEqual(paid.stocks.map(x=>x.content),['A-SAME']);
  assert.equal(products.getVariant(b).available_stock,1);
  const duplicate=payments.fulfillVerified(created.reference,{status:'paid',amount:300});
  assert.equal(duplicate.duplicate,true); assert.equal(getDb().prepare('SELECT COUNT(*) count FROM order_items WHERE order_id=?').get(paid.orderId).count,1);
});

test.after(() => closeDb());
