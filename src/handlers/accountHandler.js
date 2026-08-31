const QRCode=require('qrcode');
const {Markup}=require('telegraf');
const userService = require('../services/userService');
const orderService = require('../services/orderService');
const depositService=require('../services/depositService');
const { money, escapeHtml } = require('../utils/format');
async function replyBalance(ctx) { const user = userService.getUser(ctx.from.id); return ctx.reply(`💰 Saldo Anda: <b>${money(user.balance)}</b>`, { parse_mode: 'HTML' }); }
async function replyOrders(ctx) { const orders = orderService.userOrders(ctx.from.id); const text = orders.map((o) => `<code>${o.invoice}</code> — ${escapeHtml(o.name)} — ${escapeHtml(o.variant_name || 'Legacy')} x${o.quantity} @${money(o.unit_price)} = ${money(o.total_price)} — ${escapeHtml(o.payment_method)}/${escapeHtml(o.payment_status || o.status)} — catatan: ${escapeHtml(o.note || '-')} — ${o.created_at}`).join('\n') || 'Belum ada transaksi.'; return ctx.reply(`<b>🧾 Riwayat Transaksi</b>\n\n${text}`, { parse_mode: 'HTML' }); }
async function sendDepositPayment(ctx,r){const keyboard=Markup.inlineKeyboard([[Markup.button.callback('🔄 Cek Pembayaran',`depcheck:${r.reference}`)]]);const caption=`💰 <b>Deposit Saldo</b>\nNominal: <b>${money(r.amount)}</b>\nReference: <code>${escapeHtml(r.reference)}</code>${r.expiresAt?`\nBerlaku sampai: ${escapeHtml(String(r.expiresAt))}`:''}\n\nScan QRIS untuk melakukan deposit.`;if(r.qrString){const image=await QRCode.toBuffer(r.qrString,{type:'png',width:700,margin:2});return ctx.replyWithPhoto({source:image},{caption,parse_mode:'HTML',...keyboard});}if(r.paymentUrl){try{return await ctx.replyWithPhoto(r.paymentUrl,{caption,parse_mode:'HTML',...keyboard});}catch{return ctx.reply(`${caption}\n\nQRIS: ${escapeHtml(r.paymentUrl)}`,{parse_mode:'HTML',...keyboard});}}return ctx.reply(`${caption}\n\n⚠️ Data QRIS tidak diterima dari provider.`,{parse_mode:'HTML',...keyboard});}
async function startDeposit(ctx){ctx.session.awaitingDeposit=true;return ctx.reply(`💰 <b>Deposit Saldo</b>\n\nMinimal deposit: <b>${money(depositService.MIN_DEPOSIT)}</b>\nKirim nominal deposit yang kamu inginkan.\n\nContoh: <code>10000</code>\nKetik /cancel untuk batal.`,{parse_mode:'HTML'});}
function registerAccountHandlers(bot) {
  bot.action('account:balance', async (ctx) => { await ctx.answerCbQuery(); await replyBalance(ctx); });
  bot.action('account:orders', async (ctx) => { await ctx.answerCbQuery(); await replyOrders(ctx); });
  bot.hears('💰 Deposit',startDeposit);bot.command('deposit',startDeposit);
  bot.on('text',async(ctx,next)=>{if(!ctx.session.awaitingDeposit)return next();if(ctx.message.text==='/cancel'){delete ctx.session.awaitingDeposit;return ctx.reply('Deposit dibatalkan.');}let r;try{r=await depositService.createDeposit(ctx.from.id,ctx.message.text);}catch(e){return ctx.reply(`❌ ${e.message}\nKirim nominal lain atau /cancel.`);}delete ctx.session.awaitingDeposit;await sendDepositPayment(ctx,r);});
  bot.action(/^depcheck:(DEP-[A-Za-z0-9-]+)$/,async ctx=>{try{const r=await depositService.checkDeposit(ctx.match[1],ctx.from.id);await ctx.answerCbQuery(r.status==='paid'?'Deposit berhasil.':`Status: ${r.status}`,{show_alert:true});if(r.status==='paid'&&!r.duplicate)await ctx.reply(`✅ <b>Deposit Berhasil</b>\nSaldo masuk: <b>${money(r.amount)}</b>\nSaldo sekarang: <b>${money(r.balance)}</b>`,{parse_mode:'HTML'});}catch(e){await ctx.answerCbQuery(e.message,{show_alert:true});}});
}
module.exports = { registerAccountHandlers, replyBalance, replyOrders, startDeposit };
