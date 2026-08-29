const { config } = require('../config');
const { mainKeyboard } = require('../keyboards/main');
const { safeEdit } = require('../utils/telegram');
function welcome(name) { return `👋 Selamat datang di <b>${config.storeName}</b>, ${name}!\n\nToko produk digital otomatis. Pilih menu di bawah untuk mulai.`; }
function registerStart(bot) {
  bot.start((ctx) => ctx.reply(welcome(ctx.from.first_name), { parse_mode: 'HTML', ...mainKeyboard() }));
  bot.action('menu:main', async (ctx) => { await ctx.answerCbQuery(); await safeEdit(ctx, welcome(ctx.from.first_name), { parse_mode: 'HTML', ...mainKeyboard() }); });
}
module.exports = { registerStart };
