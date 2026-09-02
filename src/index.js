const { Telegraf, session } = require('telegraf');
const { config, validateConfig } = require('./config');
const { getDb, closeDb } = require('./database');
const userService = require('./services/userService');
const usageService=require('./services/usageService');
const backupService=require('./services/backupService');
const utilityService=require('./services/utilityService');
const { registerStart } = require('./commands/start');
const { registerAdminCommands } = require('./commands/admin');
const { registerAdminFileHandlers }=require('./handlers/adminFileHandler');
const { registerProductHandlers } = require('./handlers/productHandler');
const { registerAccountHandlers } = require('./handlers/accountHandler');
const { registerMenuHandlers } = require('./handlers/menuHandler');
const { registerUsageHandlers }=require('./handlers/usageHandler');
const { registerUtilityHandlers }=require('./handlers/utilityHandler');
const { startWebhookServer } = require('./server');

const BOT_COMMANDS = [
  { command: 'start', description: 'Mulai dan buka menu' },
  { command: 'menu', description: 'Buka menu utama' },
  { command: 'products', description: 'List produk' },
  { command: 'saldo', description: 'Cek saldo' },
  { command: 'riwayatsaldo', description: 'Riwayat saldo' },
  { command: 'orders', description: 'Riwayat pesanan' },
  { command: 'cekorder', description: 'Cek status order' },
  { command: 'deposit', description: 'Deposit saldo' },
  { command: 'voucher', description: 'Redeem voucher' },
  { command: 'gift', description: 'Klaim gift saldo' },
  { command: 'help', description: 'Hubungi owner / bantuan' }
];

validateConfig(); getDb();
const bot = new Telegraf(config.botToken);
const webhookServer = startWebhookServer(bot);
const autoBackupTimer=backupService.startAutoBackup(bot);
const maintenanceTimer=utilityService.startMaintenance(bot);
const rateState=new Map();
bot.use(session({ defaultSession: () => ({ quantities: {}, productPage: [] }) }));
bot.use(async(ctx,next)=>{if(!ctx.from)return next();const data=ctx.callbackQuery?.data||ctx.message?.text||'',sensitive=/^(paycheck:|depcheck:|\/voucher\b|\/gift\b)/i.test(data),wait=sensitive?3000:450,key=`${ctx.from.id}:${sensitive?'s':'g'}`,now=Date.now(),last=rateState.get(key)||0;if(now-last<wait){if(ctx.callbackQuery)await ctx.answerCbQuery('Tunggu sebentar sebelum mencoba lagi.').catch(()=>{});return;}rateState.set(key,now);if(rateState.size>5000)for(const[k,t]of rateState)if(now-t>60000)rateState.delete(k);return next();});
bot.use(async (ctx, next) => { if (ctx.from) {userService.upsertUser(ctx.from);try{usageService.record(ctx.from.id);}catch(e){console.warn('Pencatatan usage gagal:',e.message);}} return next(); });
registerStart(bot); registerAdminCommands(bot);registerAdminFileHandlers(bot); registerProductHandlers(bot); registerAccountHandlers(bot); registerMenuHandlers(bot);registerUsageHandlers(bot);registerUtilityHandlers(bot);
bot.catch((error, ctx) => { console.error(`Bot error pada update ${ctx.update.update_id}:`, error); ctx.reply('Terjadi kesalahan. Silakan coba lagi.').catch(() => {}); });
bot.telegram.setMyCommands(BOT_COMMANDS).then(() => bot.launch()).then(() => console.log(`${config.storeName} aktif.`)).catch((error) => { console.error('Gagal menjalankan bot:', error); closeDb(); process.exitCode = 1; });
function shutdown(signal) { console.log(`${signal}: menutup bot…`); if(autoBackupTimer)clearInterval(autoBackupTimer);if(maintenanceTimer)clearInterval(maintenanceTimer);bot.stop(signal); webhookServer?.close(); closeDb(); }
process.once('SIGINT', () => shutdown('SIGINT')); process.once('SIGTERM', () => shutdown('SIGTERM'));
module.exports = { bot, BOT_COMMANDS };
