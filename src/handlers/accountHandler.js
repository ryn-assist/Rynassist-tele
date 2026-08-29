const userService = require('../services/userService');
const orderService = require('../services/orderService');
const { money, escapeHtml } = require('../utils/format');
function registerAccountHandlers(bot) {
  bot.action('account:balance', async (ctx) => { await ctx.answerCbQuery(); const user = userService.getUser(ctx.from.id); await ctx.reply(`💰 Saldo Anda: <b>${money(user.balance)}</b>`, { parse_mode: 'HTML' }); });
  bot.action('account:orders', async (ctx) => { await ctx.answerCbQuery(); const orders = orderService.userOrders(ctx.from.id); const text = orders.map((o) => `<code>${o.invoice}</code> — ${escapeHtml(o.name)} x${o.quantity} — ${money(o.total_price)} — ${o.status}`).join('\n') || 'Belum ada transaksi.'; await ctx.reply(`<b>🧾 Riwayat Transaksi</b>\n\n${text}`, { parse_mode: 'HTML' }); });
}
module.exports = { registerAccountHandlers };
