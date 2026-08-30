const { Telegraf, session } = require('telegraf');
const { config, validateConfig } = require('./config');
const { getDb, closeDb } = require('./database');
const userService = require('./services/userService');
const { registerStart } = require('./commands/start');
const { registerAdminCommands } = require('./commands/admin');
const { registerProductHandlers } = require('./handlers/productHandler');
const { registerAccountHandlers } = require('./handlers/accountHandler');
const { registerMenuHandlers } = require('./handlers/menuHandler');
const { startWebhookServer } = require('./server');

const BOT_COMMANDS = [
  { command: 'start', description: 'Mulai dan buka menu' },
  { command: 'menu', description: 'Buka menu utama' },
  { command: 'products', description: 'List produk' },
  { command: 'wallet', description: 'Cek saldo' },
  { command: 'orders', description: 'Riwayat pesanan' },
  { command: 'help', description: 'Bantuan' }
];

validateConfig(); getDb();
const bot = new Telegraf(config.botToken);
const webhookServer = startWebhookServer(bot);
bot.use(session({ defaultSession: () => ({ quantities: {}, productPage: [] }) }));
bot.use(async (ctx, next) => {
  if (ctx.from) userService.upsertUser(ctx.from);
  return next();
});
registerStart(bot); registerAdminCommands(bot); registerProductHandlers(bot); registerAccountHandlers(bot); registerMenuHandlers(bot);
bot.catch((error, ctx) => { console.error(`Bot error pada update ${ctx.update.update_id}:`, error); ctx.reply('Terjadi kesalahan. Silakan coba lagi.').catch(() => {}); });
bot.telegram.setMyCommands(BOT_COMMANDS).then(() => bot.launch()).then(() => console.log(`${config.storeName} aktif.`)).catch((error) => {
  console.error('Gagal menjalankan bot:', error);
  closeDb();
  process.exitCode = 1;
});
function shutdown(signal) { console.log(`${signal}: menutup bot…`); bot.stop(signal); webhookServer?.close(); closeDb(); }
process.once('SIGINT', () => shutdown('SIGINT')); process.once('SIGTERM', () => shutdown('SIGTERM'));
module.exports = { bot, BOT_COMMANDS };
