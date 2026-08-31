const productService=require('../services/productService');
const restockService=require('../services/restockService');
const {config}=require('../config');
const {requirePositiveInteger}=require('../utils/validation');

const MAX_FILE_SIZE=1024*1024;
const MAX_ITEMS=5000;

async function notifyRestock(ctx,variant){
  const subscribers=restockService.takeSubscribers(variant.product_id);
  for(const row of subscribers){
    try{await ctx.telegram.sendMessage(row.user_id,`🔔 ${variant.product_name} telah restok! Gunakan /start untuk membeli.`);}
    catch(e){console.warn('Notifikasi restok gagal:',e.message);}
  }
}

function registerRestockFileHandlers(bot){
  bot.command('restockfile',async ctx=>{
    if(!ctx.from||!config.adminIds.has(String(ctx.from.id)))return ctx.reply('⛔ Perintah khusus admin.');
    const raw=ctx.message.text.replace(/^\/restockfile(?:@\w+)?\s*/i,'').trim();
    let id;try{id=requirePositiveInteger(raw,'ID varian');}catch{return ctx.reply('❌ Format: /restockfile VARIANT_ID');}
    const variant=productService.getVariant(id);
    if(!variant)return ctx.reply('❌ Varian tidak ditemukan.');
    ctx.session.awaitingRestockFile={variantId:id};
    return ctx.reply(`📄 Kirim file .txt untuk ${variant.product_name} — ${variant.name}.\n\n1 baris = 1 stok. Maksimal 1 MB / ${MAX_ITEMS} item.\nKetik /cancelrestock untuk batal.`);
  });

  bot.command('cancelrestock',ctx=>{
    if(!ctx.from||!config.adminIds.has(String(ctx.from.id)))return;
    if(!ctx.session.awaitingRestockFile)return ctx.reply('Tidak ada restock file yang sedang menunggu.');
    delete ctx.session.awaitingRestockFile;
    return ctx.reply('✅ Restock file dibatalkan.');
  });

  bot.on('document',async(ctx,next)=>{
    const pending=ctx.session.awaitingRestockFile;
    if(!pending)return next();
    if(!ctx.from||!config.adminIds.has(String(ctx.from.id)))return ctx.reply('⛔ Perintah khusus admin.');
    const doc=ctx.message.document;
    if(!/\.txt$/i.test(doc.file_name||''))return ctx.reply('❌ File harus berformat .txt.');
    if(Number(doc.file_size||0)>MAX_FILE_SIZE)return ctx.reply('❌ File terlalu besar. Maksimal 1 MB.');
    const variant=productService.getVariant(pending.variantId);
    if(!variant){delete ctx.session.awaitingRestockFile;return ctx.reply('❌ Varian tidak ditemukan lagi.');}
    try{
      const link=await ctx.telegram.getFileLink(doc.file_id);
      const response=await fetch(link);
      if(!response.ok)throw new Error(`Gagal download file (${response.status}).`);
      let text=await response.text();
      text=text.replace(/^\uFEFF/,'');
      const items=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
      if(!items.length)throw new Error('File kosong.');
      if(items.length>MAX_ITEMS)throw new Error(`Maksimal ${MAX_ITEMS} item per file.`);
      let inserted=0;
      for(let i=0;i<items.length;i+=100)inserted+=productService.addVariantStock(variant.id,items.slice(i,i+100));
      delete ctx.session.awaitingRestockFile;
      await ctx.reply(`✅ Restock file berhasil.\nProduk: ${variant.product_name}\nVariasi: ${variant.name}\nStok masuk: ${inserted} item.`);
      await notifyRestock(ctx,variant);
    }catch(e){await ctx.reply(`❌ ${e.message}\nSilakan kirim ulang file .txt atau /cancelrestock.`);}
  });
}
module.exports={registerRestockFileHandlers,MAX_FILE_SIZE,MAX_ITEMS};
