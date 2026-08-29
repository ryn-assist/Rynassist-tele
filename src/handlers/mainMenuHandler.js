const { config } = require('../config');
const productService = require('../services/productService');
const { replyList, replyDetail } = require('./productHandler');
const { showOrders } = require('./accountHandler');
const { mainKeyboard } = require('../keyboards/main');
const { escapeHtml } = require('../utils/format');

async function selectProductByPosition(ctx, position) {
  const product = productService.getActiveProductByPosition(position);
  if (!product) return ctx.reply('Produk nomor tersebut belum tersedia.');
  return replyDetail(ctx, product.id);
}

function registerMainMenuHandlers(bot) {
  bot.command('products', (ctx) => replyList(ctx));
  bot.hears('🏷️ List Produk', (ctx) => replyList(ctx));
  bot.hears('📜 Riwayat', showOrders);
  bot.hears('💰 Deposit', (ctx) => ctx.reply('💰 <b>Deposit RynAssist</b>\n\nFitur deposit akan dihubungkan ke payment provider pada tahap berikutnya. Saat ini penambahan saldo dapat dilakukan melalui admin.', { parse_mode: 'HTML', ...mainKeyboard() }));
  bot.hears('❔ Cara Order', (ctx) => ctx.reply('<b>❔ Cara Order</b>\n\n1. Buka List Produk atau tekan nomor 1-25.\n2. Pilih produk dan atur jumlah pembelian.\n3. Tekan Buy (Saldo), lalu konfirmasi.\n4. Setelah transaksi berhasil, data produk dikirim otomatis.', { parse_mode: 'HTML', ...mainKeyboard() }));
  bot.hears('⚠️ Information', (ctx) => ctx.reply(`<b>⚠️ ${escapeHtml(config.storeName)}</b>\n\nStore produk digital otomatis dengan pemrosesan saldo dan stok secara aman. Jangan bagikan data produk yang telah diterima kepada pihak lain.`, { parse_mode: 'HTML', ...mainKeyboard() }));
  bot.hears('📮 Voucher', (ctx) => ctx.reply('📮 <b>Voucher RynAssist</b>\n\nFitur voucher sedang dipersiapkan dan belum tersedia pada tahap ini.', { parse_mode: 'HTML', ...mainKeyboard() }));
  bot.hears('🗂️ Laporan Stok', async (ctx) => {
    const products = productService.activeStockSummary();
    if (!products.length) return ctx.reply('<b>🗂️ Laporan Stok Produk Aktif</b>\n\nBelum ada produk aktif.', { parse_mode: 'HTML', ...mainKeyboard() });
    const chunks = [];
    for (const [index, product] of products.entries()) {
      const line = `${index + 1}. ${escapeHtml(product.name)} — ${product.available_stock} tersedia`;
      if (!chunks.length || `${chunks.at(-1)}\n${line}`.length > 3500) chunks.push(line);
      else chunks[chunks.length - 1] += `\n${line}`;
    }
    for (const [index, chunk] of chunks.entries()) {
      const title = index === 0 ? '<b>🗂️ Laporan Stok Produk Aktif</b>\n\n' : '';
      await ctx.reply(`${title}${chunk}`, { parse_mode: 'HTML', ...mainKeyboard() });
    }
  });
  bot.hears(/^(?:[1-9]|1\d|2[0-5])$/, (ctx) => selectProductByPosition(ctx, Number(ctx.message.text)));
}

module.exports = { registerMainMenuHandlers, selectProductByPosition };
