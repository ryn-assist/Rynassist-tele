const userService = require('../services/userService');
const orderService = require('../services/orderService');
const { config } = require('../config');
const { money, escapeHtml } = require('../utils/format');
async function showBalance(ctx) {
  const user = userService.getUser(ctx.from.id);
  return ctx.reply(`💰 Saldo Anda: <b>${money(user.balance)}</b>`, { parse_mode: 'HTML' });
}
async function showOrders(ctx) {
  const orders = orderService.userOrders(ctx.from.id);
  const text = orders.map((order) => `<code>${order.invoice}</code> — ${escapeHtml(order.name)} x${order.quantity} — ${money(order.total_price)} — ${order.status}`).join('\n') || 'Belum ada transaksi.';
  return ctx.reply(`<b>🧾 Riwayat Transaksi</b>\n\n${text}`, { parse_mode: 'HTML' });
}
function registerAccountHandlers(bot) {
  bot.command('wallet', showBalance);
  bot.command('orders', async (ctx, next) => config.adminIds.has(String(ctx.from.id)) ? next() : showOrders(ctx));
  bot.action('account:balance', async (ctx) => { await ctx.answerCbQuery(); await showBalance(ctx); });
  bot.action('account:orders', async (ctx) => { await ctx.answerCbQuery(); await showOrders(ctx); });
}
module.exports = { registerAccountHandlers, showBalance, showOrders };
