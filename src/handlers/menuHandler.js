const { config } = require('../config');
const productService = require('../services/productService');
const voucherService = require('../services/voucherService');
const { replyList, replyDetailByPosition } = require('./productHandler');
const { replyOrders } = require('./accountHandler');
const { escapeHtml, money } = require('../utils/format');

function replyStockSummary(ctx) {
  const products = productService.activeStockSummary();
  const rows = products.map((product, index) => `${index + 1}. ${escapeHtml(product.name)} — ${product.available_stock} tersedia`);
  return ctx.reply(`<b>🗂️ Laporan Stok Produk Aktif</b>\n\n${rows.join('\n') || 'Belum ada produk aktif.'}`, { parse_mode: 'HTML' });
}
function help(ctx){const contact=config.ownerContact||'Kontak owner belum diatur.';return ctx.reply(`🆘 <b>Bantuan RynAssist</b>\n\nJika ada masalah dengan pesanan, pembayaran, deposit, atau produk, silakan hubungi owner:\n${escapeHtml(contact)}`,{parse_mode:'HTML'});}
function startVoucher(ctx){ctx.session.awaitingVoucher=true;return ctx.reply('📮 <b>Redeem Voucher</b>\n\nKirim kode voucher kamu.\nKetik /cancel untuk batal.',{parse_mode:'HTML'});}
function registerMenuHandlers(bot) {
  bot.hears('🏷️ List Produk', (ctx) => replyList(ctx));
  bot.hears('📜 Riwayat', replyOrders);
  bot.hears('❔ Cara Order', help);
  bot.hears('⚠️ Information', (ctx) => ctx.reply(`ℹ️ ${config.storeName} adalah toko produk digital otomatis. Gunakan /help jika membutuhkan bantuan.`));
  bot.hears('📮 Voucher', startVoucher);
  bot.hears('🗂️ Laporan Stok', replyStockSummary);
  bot.on('text',async(ctx,next)=>{if(!ctx.session.awaitingVoucher)return next();if(ctx.message.text==='/cancel'){delete ctx.session.awaitingVoucher;return ctx.reply('Redeem voucher dibatalkan.');}try{const r=voucherService.redeem(ctx.message.text,ctx.from.id);delete ctx.session.awaitingVoucher;return ctx.reply(`✅ <b>Voucher Berhasil</b>\nKode: <code>${escapeHtml(r.code)}</code>\nSaldo masuk: <b>${money(r.amount)}</b>\nSaldo sekarang: <b>${money(r.balance)}</b>`,{parse_mode:'HTML'});}catch(e){return ctx.reply(`❌ ${e.message}\nKirim kode lain atau /cancel.`);}});
  bot.hears(/^\d+$/, (ctx) => replyDetailByPosition(ctx, Number(ctx.match[0])));
  bot.command('products', (ctx) => replyList(ctx));
  bot.command('orders', replyOrders);
  bot.command('help', help);
  bot.command('voucher',startVoucher);
}
module.exports = { registerMenuHandlers, replyStockSummary, help, startVoucher };
