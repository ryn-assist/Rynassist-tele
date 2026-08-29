const { Markup } = require('telegraf');
const productService = require('../services/productService');
const restockService = require('../services/restockService');
const paymentProvider = require('../services/payment/placeholderProvider');
const orderService = require('../services/orderService');
const { productListKeyboard, productDetailKeyboard } = require('../keyboards/product');
const { money, escapeHtml } = require('../utils/format');
const { safeEdit, safeAnswerCallback } = require('../utils/telegram');
const { isValidProductCallback } = require('../utils/callback');
const { requirePositiveInteger } = require('../utils/validation');

function detailText(product, quantity) {
  return `<b>📦 Detail Produk</b>\n\n<b>Nama:</b> ${escapeHtml(product.name)}\n<b>Kode:</b> <code>${escapeHtml(product.code)}</code>\n<b>Sisa stok:</b> ${product.available_stock}\n<b>Stok terjual:</b> ${product.sold_count}\n<b>Total stok:</b> ${product.total_stock}\n\n<b>Deskripsi:</b>\n${escapeHtml(product.description || '-')}\n\n<b>Jumlah pembelian:</b> ${quantity}\n<b>Harga satuan:</b> ${money(product.price)}\n<b>Total harga:</b> ${money(product.price * quantity)}`;
}
function quantity(ctx, productId) {
  const value = ctx.session.quantities?.[productId];
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
function setQuantity(ctx, productId, value) { ctx.session.quantities ||= {}; ctx.session.quantities[productId] = value; }

async function showList(ctx, page, popular = false) {
  const result = productService.listProducts(page, 10, popular);
  ctx.session.productPage = result.items.map((p) => p.id);
  const title = popular ? '🔥 <b>Produk Populer</b>' : '📦 <b>List Produk</b>';
  const instruction = result.items.length ? `Pilih produk melalui tombol atau kirim nomor 1-${result.items.length}.` : 'Belum ada produk aktif.';
  const text = `${title}\n\n${instruction}\nHalaman ${result.page}/${result.pages}`;
  await safeEdit(ctx, text, { parse_mode: 'HTML', ...productListKeyboard(result, ctx.from.id, popular) });
}
async function replyList(ctx, page = 1) {
  const result = productService.listProducts(page, 10);
  ctx.session.productPage = result.items.map((product) => product.id);
  const instruction = result.items.length ? `Pilih produk melalui tombol atau kirim nomor 1-${result.items.length}.` : 'Belum ada produk aktif.';
  return ctx.reply(`📦 <b>List Produk</b>\n\n${instruction}\nHalaman ${result.page}/${result.pages}`, { parse_mode: 'HTML', ...productListKeyboard(result, ctx.from.id, false) });
}
async function showDetail(ctx, productId) {
  const product = productService.getProduct(productId);
  if (!product?.is_active) return ctx.answerCbQuery?.('Produk tidak ditemukan.', { show_alert: true });
  let qty = quantity(ctx, productId);
  if (product.available_stock > 0) qty = Math.min(qty, product.available_stock); else qty = 1;
  setQuantity(ctx, productId, qty);
  ctx.session.activeProductId = productId;
  await safeEdit(ctx, detailText(product, qty), { parse_mode: 'HTML', ...productDetailKeyboard(ctx.from.id, productId, qty, product.available_stock) });
}
async function replyDetail(ctx, productId) {
  const product = productService.getProduct(productId);
  if (!product?.is_active) return ctx.reply('Produk tidak aktif atau tidak ditemukan.');
  const qty = 1;
  setQuantity(ctx, productId, qty);
  ctx.session.activeProductId = productId;
  return ctx.reply(detailText(product, qty), { parse_mode: 'HTML', ...productDetailKeyboard(ctx.from.id, productId, qty, product.available_stock) });
}
function validSignedCallback(ctx, action, rawId, suppliedSignature) {
  const id = requirePositiveInteger(rawId, 'ID produk');
  if (!isValidProductCallback(ctx.from.id, action, id, suppliedSignature)) throw new Error('Callback produk tidak valid.');
  return id;
}
function registerProductHandlers(bot) {
  bot.action(/^products:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); await showList(ctx, Number(ctx.match[1])); });
  bot.action(/^popular:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); await showList(ctx, Number(ctx.match[1]), true); });
  bot.action(/^product:(\d+):([a-f0-9]{12})$/, async (ctx) => { const id = validSignedCallback(ctx, 'product', ctx.match[1], ctx.match[2]); await ctx.answerCbQuery(); await showDetail(ctx, id); });
  bot.action(/^(minus|plus|reset):(\d+):([a-f0-9]{12})$/, async (ctx) => {
    const [, action, rawId, suppliedSignature] = ctx.match; const id = validSignedCallback(ctx, action, rawId, suppliedSignature); const product = productService.getProduct(id);
    if (!product?.is_active || ctx.session.activeProductId !== id) return ctx.answerCbQuery('Pilihan produk tidak valid. Buka ulang detail produk.', { show_alert: true });
    let qty = quantity(ctx, id);
    if (action === 'minus') qty = Math.max(1, qty - 1);
    if (action === 'plus') qty = Math.min(product.available_stock || 1, qty + 1);
    if (action === 'reset') qty = 1;
    setQuantity(ctx, id, qty); await ctx.answerCbQuery(qty >= product.available_stock && action === 'plus' ? 'Quantity maksimal sesuai stok.' : undefined); await showDetail(ctx, id);
  });
  bot.action('noop', (ctx) => ctx.answerCbQuery());
  bot.action(/^restock:(\d+):([a-f0-9]{12})$/, async (ctx) => { const id = validSignedCallback(ctx, 'restock', ctx.match[1], ctx.match[2]); const product = productService.getProduct(id); if (!product?.is_active || product.available_stock > 0) return ctx.answerCbQuery('Notifikasi restock hanya tersedia untuk produk aktif yang kosong.', { show_alert: true }); const active = restockService.toggle(ctx.from.id, id); await ctx.answerCbQuery(active ? 'Notifikasi restok diaktifkan.' : 'Notifikasi restok dibatalkan.', { show_alert: true }); });
  bot.action(/^now:(\d+):([a-f0-9]{12})$/, async (ctx) => { const id = validSignedCallback(ctx, 'now', ctx.match[1], ctx.match[2]); if (ctx.session.activeProductId !== id) return ctx.answerCbQuery('Pilihan produk tidak valid.', { show_alert: true }); const result = await paymentProvider.createPayment(); await ctx.answerCbQuery(); await ctx.reply(`ℹ️ ${result.message}`); });
  bot.action(/^balance:(\d+):([a-f0-9]{12})$/, async (ctx) => {
    const id = validSignedCallback(ctx, 'balance', ctx.match[1], ctx.match[2]);
    if (ctx.session.activeProductId !== id) return ctx.answerCbQuery('Pilihan produk tidak valid. Buka ulang detail produk.', { show_alert: true });
    const product = productService.getProduct(id); const qty = quantity(ctx, id);
    if (!product?.is_active) return ctx.answerCbQuery('Produk tidak aktif atau tidak ditemukan.', { show_alert: true });
    if (!Number.isSafeInteger(qty) || qty <= 0 || product.available_stock < qty || product.available_stock === 0) return ctx.answerCbQuery('Quantity atau stok tidak valid.', { show_alert: true });
    let token;
    try { token = orderService.createIntent(ctx.from.id, id, qty); }
    catch (error) { return ctx.answerCbQuery(error.message, { show_alert: true }); }
    await ctx.answerCbQuery();
    await ctx.reply(`Konfirmasi pembelian <b>${escapeHtml(product.name)}</b> sebanyak ${qty} dengan total <b>${money(product.price * qty)}</b>?`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Konfirmasi', `confirm:${token}`), Markup.button.callback('❌ Batal', `cancel:${token}`)]]) });
  });
  bot.action(/^confirm:([a-f0-9]{24})$/, async (ctx) => {
    let result;
    try {
      result = orderService.fulfillBalanceIntent(ctx.match[1], ctx.from.id);
    } catch (error) { return safeAnswerCallback(ctx, error.message, { show_alert: true }); }
    const message = `✅ <b>Order Berhasil</b>\nInvoice: <code>${result.invoice}</code>\nProduk: ${escapeHtml(result.product.name)}\nTotal: ${money(result.total)}\nSisa saldo: ${money(result.balance)}\n\nData produk dikirim di bawah ini. Simpan dengan aman.`;
    await ctx.reply(message, { parse_mode: 'HTML' });
    for (const [index, stock] of result.stocks.entries()) {
      await ctx.reply(`Data item ${index + 1}/${result.stocks.length}:\n${stock.content}`);
    }
    await safeAnswerCallback(ctx, 'Order berhasil!');
    await safeEdit(ctx, `✅ Order <code>${result.invoice}</code> telah diproses dan data produk dikirim pada pesan baru.`, { parse_mode: 'HTML' });
  });
  bot.action(/^cancel:([a-f0-9]{24})$/, async (ctx) => { orderService.cancelIntent(ctx.match[1], ctx.from.id); await ctx.answerCbQuery('Dibatalkan.'); await safeEdit(ctx, 'Pembelian dibatalkan.'); });
}
module.exports = { registerProductHandlers, showList, replyList, showDetail, replyDetail };
