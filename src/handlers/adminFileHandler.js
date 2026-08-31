const {config}=require('../config');
const products=require('../services/productService');
const restock=require('../services/restockService');
const MAX_FILE_BYTES=1024*1024;
function admin(ctx){return ctx.from&&config.adminIds.has(String(ctx.from.id));}
function lines(text){const rows=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!rows.length)throw new Error('File .txt kosong.');if(rows.length>5000)throw new Error('Maksimal 5.000 baris stok per file.');return rows;}
async function notifyRestock(ctx,variant){const subscribers=restock.takeSubscribers(variant.product_id);for(const row of subscribers){try{await ctx.telegram.sendMessage(row.user_id,`🔔 ${variant.product_name} telah restok! Gunakan /start untuk membeli.`);}catch(e){console.warn(e.message);}}}
function registerAdminFileHandlers(bot){
 bot.command('restockfile',async ctx=>{if(!admin(ctx))return ctx.reply('⛔ Perintah khusus admin.');const raw=ctx.message.text.replace(/^\/restockfile(?:@\w+)?\s*/i,'').trim();const id=Number(raw);if(!Number.isSafeInteger(id)||id<=0||!products.getVariant(id))return ctx.reply('❌ Format: /restockfile VARIANT_ID');ctx.session.awaitingRestockFile=id;return ctx.reply(`📄 Kirim file .txt untuk varian ID ${id}.\nSetiap baris akan dianggap sebagai 1 stok.\nKetik /cancel untuk batal.`);});
 bot.on('document',async(ctx,next)=>{if(!admin(ctx)||!ctx.session.awaitingRestockFile)return next();const id=ctx.session.awaitingRestockFile;const doc=ctx.message.document;if(!/\.txt$/i.test(doc.file_name||''))return ctx.reply('❌ File harus berformat .txt.');if(Number(doc.file_size||0)>MAX_FILE_BYTES)return ctx.reply('❌ File terlalu besar. Maksimal 1 MB.');try{const link=await ctx.telegram.getFileLink(doc.file_id);const response=await fetch(link);if(!response.ok)throw new Error('Gagal mengunduh file Telegram.');const items=lines(await response.text());let total=0;for(let i=0;i<items.length;i+=100)total+=products.addVariantStock(id,items.slice(i,i+100));const variant=products.getVariant(id);delete ctx.session.awaitingRestockFile;await ctx.reply(`✅ Restock dari file berhasil.\n${variant.product_name} — ${variant.name}\nStok masuk: ${total} item.`);await notifyRestock(ctx,variant);}catch(e){await ctx.reply(`❌ ${e.message}`);}});
}
module.exports={registerAdminFileHandlers,lines};
