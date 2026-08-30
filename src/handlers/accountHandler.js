const userService = require('../services/userService');
const orderService = require('../services/orderService');
const { money, escapeHtml } = require('../utils/format');
async function replyBalance(ctx) { const user = userService.getUser(ctx.from.id); return ctx.reply(`💰 Saldo Anda: <b>${money(user.balance)}</b>`, { parse_mode: 'HTML' }); }
async function replyOrders(ctx) { const orders = orderService.userOrders(ctx.from.id); const text = orders.map((o) => `<code>${o.invoice}</code> — ${escapeHtml(o.name)} — ${escapeHtml(o.variant_name || 'Legacy')} x${o.quantity} @${money(o.unit_price)} = ${money(o.total_price)} — ${escapeHtml(o.payment_method)}/${escapeHtml(o.payment_status || o.status)} — catatan: ${escapeHtml(o.note || '-')} — ${o.created_at}`).join('\n') || 'Belum ada transaksi.'; return ctx.reply(`<b>🧾 Riwayat Transaksi</b>\n\n${text}`, { parse_mode: 'HTML' }); }
function registerAccountHandlers(bot) {
  bot.action('account:balance', async (ctx) => { await ctx.answerCbQuery(); await replyBalance(ctx); });
  bot.action('account:orders', async (ctx) => { await ctx.answerCbQuery(); await replyOrders(ctx); });
}
module.exports = { registerAccountHandlers, replyBalance, replyOrders };
