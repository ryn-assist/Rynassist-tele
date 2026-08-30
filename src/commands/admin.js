const productService = require('../services/productService');
const userService = require('../services/userService');
const orderService = require('../services/orderService');
const restockService = require('../services/restockService');
const { getDb } = require('../database');
const { config } = require('../config');
const { money, escapeHtml } = require('../utils/format');
const { requirePositiveInteger, requireTelegramId, requireText } = require('../utils/validation');

function parts(ctx) { return ctx.message.text.replace(/^\/\w+(?:@\w+)?\s*/, '').split('|').map((v) => v.trim()); }
function exactParts(ctx, minimum, maximum = minimum) {
  const values = parts(ctx);
  if (values.length < minimum || values.length > maximum) throw new Error('Jumlah parameter tidak sesuai.');
  return values;
}
function adminOnly(handler) {
  return async (ctx) => {
    if (!ctx.from || !config.adminIds.has(String(ctx.from.id))) return ctx.reply('⛔ Perintah khusus admin.');
    try { await handler(ctx); } catch (error) { await ctx.reply(`❌ ${error.message}`); }
  };
}
function registerAdminCommands(bot) {
  bot.command('admin', adminOnly((ctx) => ctx.reply(`<b>Panel Admin RynAssist</b>\n\n/addproduct KODE | Nama | Harga | Deskripsi\n/editproduct ID | field | nilai\n/deleteproduct ID\n/addvariant PRODUCT_ID | Nama | Harga\n/editvariant VARIANT_ID | field | nilai\n/deletevariant VARIANT_ID\n/variants PRODUCT_ID\n/restockvariant VARIANT_ID | item1 | item2\n/restock ID | item1 | item2\n/stocks\n/orders\n/users\n/balance USER_ID | jumlah (+/-) | catatan\n/broadcast pesan\n/stats`, { parse_mode: 'HTML' })));
  bot.command('addproduct', adminOnly(async (ctx) => {
    let values; try { values = exactParts(ctx, 3, 4); } catch { throw new Error('Format: /addproduct KODE | Nama | Harga | Deskripsi'); }
    const [code, name, price, description = ''] = values;
    const id = productService.createProduct({ code, name, price, description }); await ctx.reply(`✅ Produk dibuat dengan ID ${id}.`);
  }));
  bot.command('editproduct', adminOnly(async (ctx) => {
    let values; try { values = exactParts(ctx, 3); } catch { throw new Error('Format: /editproduct ID | field | nilai'); }
    const [rawId, rawField, rawValue] = values; const id = requirePositiveInteger(rawId, 'ID produk'); const field = rawField.toLowerCase();
    if (!productService.updateProduct(id, field, rawValue).changes) throw new Error('Produk tidak ditemukan.'); await ctx.reply('✅ Produk diperbarui.');
  }));
  bot.command('deleteproduct', adminOnly(async (ctx) => { let values; try { values = exactParts(ctx, 1); } catch { throw new Error('Format: /deleteproduct ID'); } const id = requirePositiveInteger(values[0], 'ID produk'); const result = productService.deleteProduct(id); if (!result.changes) throw new Error('Produk tidak ditemukan.'); await ctx.reply('✅ Produk dihapus/dinonaktifkan.'); }));
  bot.command('addvariant', adminOnly(async (ctx) => { let v; try { v=exactParts(ctx,3); } catch { throw new Error('Format: /addvariant PRODUCT_ID | Nama | Harga'); } const id=productService.createVariant(v[0],v[1],v[2]); await ctx.reply(`✅ Varian dibuat dengan ID ${id}.`); }));
  bot.command('editvariant', adminOnly(async (ctx) => { let v; try { v=exactParts(ctx,3); } catch { throw new Error('Format: /editvariant VARIANT_ID | field | nilai'); } const result=productService.updateVariant(v[0],v[1].toLowerCase(),v[2]); if(!result.changes)throw new Error('Varian tidak ditemukan.'); await ctx.reply('✅ Varian diperbarui.'); }));
  bot.command('deletevariant', adminOnly(async (ctx) => { let v; try { v=exactParts(ctx,1); } catch { throw new Error('Format: /deletevariant VARIANT_ID'); } const result=productService.deleteVariant(v[0]);if(!result.changes)throw new Error('Varian tidak ditemukan.');await ctx.reply('✅ Varian dinonaktifkan.'); }));
  bot.command('variants', adminOnly(async (ctx) => { let v;try{v=exactParts(ctx,1);}catch{throw new Error('Format: /variants PRODUCT_ID');}const product=productService.getProduct(v[0]);if(!product)throw new Error('Produk tidak ditemukan.');const rows=productService.listVariants(v[0]);const text=rows.map(x=>`${x.id}. ${escapeHtml(x.name)} — ${money(x.price)} — stok ${x.available_stock}${x.is_active?'':' — nonaktif'}`).join('\n')||'Belum ada varian.';await ctx.reply(`<b>${escapeHtml(product.name)}</b>\n\n${text}`,{parse_mode:'HTML'}); }));
  bot.command('restockvariant', adminOnly(async (ctx) => { const v=parts(ctx);if(v.length<2||v.length>101)throw new Error('Format: /restockvariant VARIANT_ID | item1 | item2 (maksimal 100 item)');const variant=productService.getVariant(v[0]);if(!variant)throw new Error('Varian tidak ditemukan.');const count=productService.addVariantStock(v[0],v.slice(1));await ctx.reply(`✅ ${count} item ditambahkan ke ${variant.product_name} — ${variant.name}.`);const subscribers=restockService.takeSubscribers(variant.product_id);for(const row of subscribers){try{await ctx.telegram.sendMessage(row.user_id,`🔔 ${variant.product_name} telah restok! Gunakan /start untuk membeli.`);}catch(error){console.warn(`Gagal notif ${row.user_id}: ${error.message}`);}} }));
  bot.command('restock', adminOnly(async (ctx) => {
    const values = parts(ctx); if (values.length < 2 || values.length > 101) throw new Error('Format: /restock ID | item1 | item2 (maksimal 100 item)');
    const [rawId, ...items] = values; const id = requirePositiveInteger(rawId, 'ID produk'); const product = productService.getProduct(id);
    if (!product) throw new Error('Produk tidak ditemukan.');
    const count = productService.addStock(id, items); await ctx.reply(`✅ ${count} item ditambahkan ke ${product.name}.`);
    const subscribers = restockService.takeSubscribers(id);
    for (const row of subscribers) { try { await ctx.telegram.sendMessage(row.user_id, `🔔 ${product.name} telah restok! Gunakan /start untuk membeli.`); } catch (error) { console.warn(`Gagal notif ${row.user_id}: ${error.message}`); } }
  }));
  bot.command('stocks', adminOnly(async (ctx) => { const rows = productService.stockSummary(); const text = rows.map((p) => `${p.id}. ${escapeHtml(p.name)} — tersedia ${p.available_stock}, terjual ${p.sold_count}, total ${p.total_stock}`).join('\n') || 'Belum ada produk.'; await ctx.reply(`<b>📦 Stok</b>\n\n${text}`, { parse_mode: 'HTML' }); }));
  bot.command('orders', adminOnly(async (ctx) => { const rows = orderService.listOrders(); const text = rows.map((o) => `#${o.id} ${o.invoice} — ${escapeHtml(o.name)}${o.variant_name?` — ${escapeHtml(o.variant_name)}`:''} x${o.quantity} — ${money(o.total_price)} — ${o.status}`).join('\n') || 'Belum ada order.'; await ctx.reply(`<b>🧾 Order terbaru</b>\n\n${text}`, { parse_mode: 'HTML' }); }));
  bot.command('users', adminOnly(async (ctx) => { const rows = userService.listUsers(); const text = rows.map((u) => `${u.telegram_id} @${escapeHtml(u.username || '-')} — ${money(u.balance)}`).join('\n') || 'Belum ada user.'; await ctx.reply(`<b>👥 User terbaru</b>\n\n${text}`, { parse_mode: 'HTML' }); }));
  bot.command('balance', adminOnly(async (ctx) => { let values; try { values = exactParts(ctx, 2, 3); } catch { throw new Error('Format: /balance USER_ID | jumlah (+/-) | catatan'); } const [rawId, rawAmount, rawNote = 'Penyesuaian admin'] = values; const id = requireTelegramId(rawId); if (!/^[+-]?\d+$/.test(rawAmount)) throw new Error('Jumlah saldo harus bilangan bulat.'); const amount = Number(rawAmount); if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('Jumlah saldo tidak valid atau nol.'); const note = requireText(rawNote, 'Catatan', 200); const balance = userService.adjustBalance(id, amount, note, ctx.from.id); await ctx.reply(`✅ Saldo baru: ${money(balance)}.`); }));
  bot.command('broadcast', adminOnly(async (ctx) => { const message = requireText(ctx.message.text.replace(/^\/broadcast(?:@\w+)?\s*/, ''), 'Pesan broadcast', 3500); const users = getDb().prepare('SELECT telegram_id FROM users').all(); let sent = 0; for (const user of users) { try { await ctx.telegram.sendMessage(user.telegram_id, `📣 <b>Pengumuman RynAssist</b>\n\n${escapeHtml(message)}`, { parse_mode: 'HTML' }); sent++; } catch (error) { console.warn(`Broadcast gagal ke ${user.telegram_id}: ${error.message}`); } } await ctx.reply(`✅ Broadcast terkirim ke ${sent}/${users.length} user.`); }));
  bot.command('stats', adminOnly(async (ctx) => { const stats = getDb().prepare(`SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM products WHERE is_active=1) products,(SELECT COUNT(*) FROM orders WHERE status='paid') orders,(SELECT COALESCE(SUM(total_price),0) FROM orders WHERE status='paid') revenue,(SELECT COUNT(*) FROM stock_items WHERE status='available') stock`).get(); await ctx.reply(`<b>📊 Statistik</b>\nUser: ${stats.users}\nProduk aktif: ${stats.products}\nOrder sukses: ${stats.orders}\nOmzet: ${money(stats.revenue)}\nStok tersedia: ${stats.stock}`, { parse_mode: 'HTML' }); }));
}
module.exports = { registerAdminCommands };
