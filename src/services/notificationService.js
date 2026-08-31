const {config}=require('../config');
const {money,escapeHtml}=require('../utils/format');
const settings=require('./settingsService');
function chatId(){return settings.get('notification_chat_id',config.notificationChatId||'');}
async function transaction(bot,data){
  const target=chatId();if(!target)return false;
  const text=`🎉 <b>TRANSAKSI BARU</b>\n\nProduk: <b>${escapeHtml(data.productName||'-')}</b>\nVariasi: ${escapeHtml(data.variantName||'-')}\nJumlah: ${Number(data.quantity||0)}\nTotal: <b>${money(data.total||0)}</b>\nMetode: ${escapeHtml(data.paymentMethod||'-')}\nInvoice: <code>${escapeHtml(data.invoice||'-')}</code>\n\nTerima kasih sudah order di ${escapeHtml(config.storeName)} ♡`;
  try{await bot.telegram.sendMessage(target,text,{parse_mode:'HTML',disable_web_page_preview:true});return true;}catch(e){console.warn('Notifikasi channel gagal:',e.message);return false;}
}
module.exports={transaction,chatId};
