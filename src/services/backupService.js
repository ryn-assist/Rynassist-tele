const fs=require('node:fs');
const path=require('node:path');
const archiver=require('archiver');
const {getDb}=require('../database');
const {config}=require('../config');

function stamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
function exists(file){try{return fs.existsSync(file);}catch{return false;}}

async function createBackup(){
  const root=process.cwd();
  const dir=path.resolve(root,'backups');
  fs.mkdirSync(dir,{recursive:true});
  const tempDb=path.join(dir,`rynassist-db-${stamp()}.db`);
  const zipFile=path.join(dir,`RynAssist-Backup-${stamp()}.zip`);

  // Buat snapshot SQLite yang konsisten terlebih dahulu agar stok/transaksi aman.
  await getDb().backup(tempDb);

  try{
    await new Promise((resolve,reject)=>{
      const output=fs.createWriteStream(zipFile);
      const archive=archiver('zip',{zlib:{level:9}});
      output.on('close',resolve);
      output.on('error',reject);
      archive.on('warning',err=>{if(err.code!=='ENOENT')reject(err);});
      archive.on('error',reject);
      archive.pipe(output);

      // Backup SC runtime lengkap, tetapi abaikan file besar/sementara.
      archive.glob('**/*',{
        cwd:root,
        dot:true,
        ignore:[
          'node_modules/**',
          'backups/**',
          '.git/**',
          'data/*.db',
          'data/*.db-*',
          '*.log',
          'npm-debug.log*'
        ]
      },{prefix:'RynAssist'});

      // Database aktif diganti snapshot SQLite yang konsisten di dalam ZIP.
      archive.file(tempDb,{name:'RynAssist/data/rynassist.db'});
      archive.finalize();
    });
    return zipFile;
  }catch(error){
    if(exists(zipFile))try{fs.unlinkSync(zipFile);}catch{}
    throw error;
  }finally{
    if(exists(tempDb))try{fs.unlinkSync(tempDb);}catch{}
  }
}

async function sendBackup(bot,chatId,label='Backup lengkap RynAssist'){
  const file=await createBackup();
  try{
    await bot.telegram.sendDocument(chatId,{source:file,filename:path.basename(file)},{caption:`🗄 ${label}\n\nZIP berisi SC + konfigurasi + snapshot database. Simpan file ini dengan aman karena .env ikut dibackup.`});
  }finally{
    if(exists(file))try{fs.unlinkSync(file);}catch{}
  }
}

function startAutoBackup(bot){
  if(!config.autoBackupEnabled||config.adminIds.size===0)return null;
  const run=async()=>{for(const id of config.adminIds){try{await sendBackup(bot,id,'Auto backup lengkap RynAssist');}catch(e){console.warn('Auto backup gagal:',e.message);}}};
  const timer=setInterval(run,24*60*60*1000);
  timer.unref?.();
  return timer;
}

module.exports={createBackup,sendBackup,startAutoBackup};
