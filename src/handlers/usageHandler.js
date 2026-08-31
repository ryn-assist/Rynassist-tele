const {config}=require('../config');
const usage=require('../services/usageService');
const {getDb}=require('../database');
function registerUsageHandlers(bot){
  bot.command('usage',async ctx=>{
    if(!ctx.from||!config.adminIds.has(String(ctx.from.id)))return ctx.reply('⛔ Perintah khusus admin.');
    const s=usage.summary();
    const totalUsers=getDb().prepare('SELECT COUNT(*) count FROM users').get().count;
    return ctx.reply(`<b>📈 Statistik Penggunaan</b>\n\nHari ini\n• User aktif: ${s.today.active_users}\n• Interaksi: ${s.today.interactions}\n\nBulan ini\n• User aktif: ${s.month.active_users}\n• Interaksi: ${s.month.interactions}\n\nSemua waktu\n• User pernah aktif: ${s.all.active_users}\n• Total interaksi: ${s.all.interactions}\n• User terdaftar: ${totalUsers}`,{parse_mode:'HTML'});
  });
}
module.exports={registerUsageHandlers};
