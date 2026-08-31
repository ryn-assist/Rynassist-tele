const { config } = require('../config');
const { mainKeyboard } = require('../keyboards/main');
const { safeEdit } = require('../utils/telegram');
const settings=require('../services/settingsService');
function welcome(name) { return `👋 Selamat datang di <b>${config.storeName}</b>, ${name}!\n\nToko produk digital otomatis. Pilih menu di bawah untuk mulai.`; }
async function openMainMenu(ctx) {
  const text=welcome(ctx.from.first_name),extra={parse_mode:'HTML',...mainKeyboard()};
  if(settings.bannerEnabled()&&settings.bannerUrl()){
    try{return await ctx.replyWithPhoto(settings.bannerUrl(),{caption:text,...extra});}catch(e){console.warn('Banner gagal dikirim:',e.message);}
  }
  return ctx.reply(text,extra);
}
function registerStart(bot) {
  bot.start(openMainMenu);
  bot.command('menu', openMainMenu);
  bot.command('help',ctx=>ctx.reply(`🆘 <b>Bantuan ${config.storeName}</b>\n\nJika ada masalah dengan pesanan, pembayaran, deposit, atau produk, silakan hubungi owner:\n<b>${config.ownerContact||'Kontak owner belum diatur.'}</b>`,{parse_mode:'HTML'}));
  bot.action('menu:main', async (ctx) => { await ctx.answerCbQuery(); await safeEdit(ctx, welcome(ctx.from.first_name), { parse_mode: 'HTML' }); await openMainMenu(ctx); });
}
module.exports = { openMainMenu, registerStart, welcome };
