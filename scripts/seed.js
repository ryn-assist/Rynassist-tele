const { getDb, closeDb } = require('../src/database');
const productService = require('../src/services/productService');
const dummy = [
  { code: 'CANVA1B', name: 'Canva Pro 1 Bulan', price: 15000, description: 'Akun Canva Pro bergaransi sesuai ketentuan toko.', stock: ['dummy-canva-1@example.test|password-demo', 'dummy-canva-2@example.test|password-demo'] },
  { code: 'VPN30', name: 'VPN Premium 30 Hari', price: 10000, description: 'Kode aktivasi VPN premium selama 30 hari.', stock: ['DUMMY-VPN-CODE-001', 'DUMMY-VPN-CODE-002'] },
  { code: 'GAME10', name: 'Voucher Game 10K', price: 11000, description: 'Kode voucher game nominal 10.000.', stock: ['DUMMY-GAME-CODE-001'] }
];
for (const item of dummy) { if (productService.getProductByCode(item.code)) { console.log(`Lewati ${item.code}: sudah ada.`); continue; } const id = productService.createProduct(item); productService.addStock(id, item.stock); console.log(`Tambah ${item.code} (ID ${id}).`); }
closeDb();
