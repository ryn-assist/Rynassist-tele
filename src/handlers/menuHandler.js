const { config } = require('../config');
const productService = require('../services/productService');
const { replyList, replyDetailByPosition } = require('./productHandler');
const { replyBalance, replyOrders } = require('./accountHandler');
const { escapeHtml } = require('../utils/format');

function replyStockSummary(ctx) {
  const products = productService.activeStockSummary();
  const rows = products.map((product, index) => `${index + 1}. ${escapeHtml(product.name)} — ${product.available_stock} tersedia`);
  return ctx.reply(`<b>🗂️ Laporan Stok Produk Aktif</b>\n\n${rows.join('\n') || 'Belum ada produk aktif.'}`, { parse_mode: 'HTML' });
}

function registerMenuHandlers(bot) {
  bot.hears('🏷️ List Produk', (ctx) => replyList(ctx));
  bot.hears('📜 Riwayat', replyOrders);
  bot.hears('❔ Cara Order', (ctx) => ctx.reply('Pilih List Produk atau tekan nomor produk, atur quantity, lalu pilih Buy (Saldo) atau Buy (Now).'));
  bot.hears('⚠️ Information', (ctx) => ctx.reply(`ℹ️ ${config.storeName} adalah toko produk digital otomatis. Gunakan /help jika membutuhkan bantuan.`));
  bot.hears('📮 Voucher', (ctx) => ctx.reply('📮 Fitur voucher sedang dalam pengembangan.'));
  bot.hears('🗂️ Laporan Stok', replyStockSummary);
  bot.hears(/^\d+$/, (ctx) => replyDetailByPosition(ctx, Number(ctx.match[0])));
  bot.command('products', (ctx) => replyList(ctx));
  bot.command('wallet', replyBalance);
  bot.command('orders', replyOrders);
  bot.command('help', (ctx) => ctx.reply('Gunakan /menu untuk membuka menu utama. Pilih produk, atur quantity, lalu pilih metode pembelian.'));
}

module.exports = { registerMenuHandlers, replyStockSummary };
