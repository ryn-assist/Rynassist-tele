const { Markup } = require('telegraf');
const productService = require('../services/productService');

function numberRows(productCount) {
  const numbers = Array.from({ length: productCount }, (_, index) => String(index + 1));
  const rows = [];
  for (let index = 0; index < numbers.length; index += 5) rows.push(numbers.slice(index, index + 5));
  return rows;
}

function mainKeyboard() {
  const rows = [
    ['🏷️ List Produk', '📮 Voucher', '🎁 Gift Saldo'],
    ...numberRows(productService.activeProductCount()),
    ['💰 Cek Saldo', '💰 Deposit', '💳 Riwayat Saldo'],
    ['🗂️ Laporan Stok', '❔ Cara Order'],
    ['⚠️ Information', '📜 Riwayat']
  ];
  return Markup.keyboard(rows)
    .resize(true)
    .oneTime(false);
}

module.exports = { numberRows, mainKeyboard };
