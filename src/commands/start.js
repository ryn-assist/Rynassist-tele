const { config } = require('../config');
const { mainKeyboard } = require('../keyboards/main');
const { escapeHtml } = require('../utils/format');

function welcome(name) { return `👋 Selamat datang di <b>${escapeHtml(config.storeName)}</b>, ${escapeHtml(name)}!\n\nToko produk digital otomatis. Pilih menu di keyboard bawah untuk mulai.`; }
async function showMainMenu(ctx) {
  return ctx.reply(welcome(ctx.from.first_name || 'Pelanggan'), { parse_mode: 'HTML', ...mainKeyboard() });
}
function registerStart(bot) {
  bot.start(showMainMenu);
  bot.command('menu', showMainMenu);
  bot.command('help', (ctx) => ctx.reply('Gunakan 🏷️ List Produk untuk melihat produk, pilih nomor produk, atur quantity, lalu pilih metode pembelian. Gunakan /menu untuk menampilkan kembali keyboard utama.', mainKeyboard()));
  bot.action('menu:main', async (ctx) => { await ctx.answerCbQuery(); await showMainMenu(ctx); });
}
module.exports = { registerStart, showMainMenu, welcome };
