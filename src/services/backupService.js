const fs=require('node:fs');
const path=require('node:path');
const {getDb}=require('../database');
const {config}=require('../config');
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
async function createBackup(){
  const dir=path.resolve(process.cwd(),'backups');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,`rynassist-${stamp()}.db`);
  await getDb().backup(file);
  return file;
}
async function sendBackup(bot,chatId,label='Backup database RynAssist'){
  const file=await createBackup();
  try{await bot.telegram.sendDocument(chatId,{source:file,filename:path.basename(file)},{caption:`🗄 ${label}`});}
  finally{try{fs.unlinkSync(file);}catch{}}
}
function startAutoBackup(bot){
  if(!config.autoBackupEnabled||config.adminIds.size===0)return null;
  const run=async()=>{for(const id of config.adminIds){try{await sendBackup(bot,id,'Auto backup database RynAssist');}catch(e){console.warn('Auto backup gagal:',e.message);}}};
  const timer=setInterval(run,24*60*60*1000);timer.unref?.();return timer;
}
module.exports={createBackup,sendBackup,startAutoBackup};
