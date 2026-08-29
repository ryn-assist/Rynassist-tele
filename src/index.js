const { Telegraf, session } = require('telegraf');
const { config, validateConfig } = require('./config');
const { getDb, closeDb } = require('./database');
const userService = require('./services/userService');
const { registerStart } = require('./commands/start');
const { registerAdminCommands } = require('./commands/admin');
const { registerProductHandlers } = require('./handlers/productHandler');
const { registerAccountHandlers } = require('./handlers/accountHandler');
const { registerMainMenuHandlers } = require('./handlers/mainMenuHandler');
const { BOT_COMMANDS } = require('./config/botCommands');

validateConfig(); getDb();
const bot = new Telegraf(config.botToken);
bot.use(session({ defaultSession: () => ({ quantities: {} }) }));
bot.use(async (ctx, next) => {
  if (ctx.from) userService.upsertUser(ctx.from);
  return next();
});
registerStart(bot);
registerProductHandlers(bot);
registerAccountHandlers(bot);
registerAdminCommands(bot);
registerMainMenuHandlers(bot);
bot.catch((error, ctx) => { console.error(`Bot error pada update ${ctx.update.update_id}:`, error); ctx.reply('Terjadi kesalahan. Silakan coba lagi.').catch(() => {}); });
async function launchBot() {
  try {
    try { await bot.telegram.setMyCommands(BOT_COMMANDS); }
    catch (error) { console.warn(`Gagal mengatur command menu Telegram: ${error.message}`); }
    await bot.launch();
    console.log(`${config.storeName} aktif.`);
  } catch (error) {
    console.error('Gagal menjalankan bot:', error);
    closeDb();
    process.exitCode = 1;
  }
}
launchBot();
function shutdown(signal) { console.log(`${signal}: menutup bot…`); bot.stop(signal); closeDb(); }
process.once('SIGINT', () => shutdown('SIGINT')); process.once('SIGTERM', () => shutdown('SIGTERM'));
module.exports = { bot, BOT_COMMANDS };
