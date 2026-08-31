const crypto=require('node:crypto');
const {getDb}=require('../database');
const {getProvider}=require('../payments');
const MIN_DEPOSIT=1000;
function makeReference(){return `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;}
function validAmount(value){const amount=Number(String(value).replace(/[^0-9]/g,''));if(!Number.isSafeInteger(amount)||amount<MIN_DEPOSIT)throw new Error(`Minimal deposit Rp${MIN_DEPOSIT.toLocaleString('id-ID')}.`);return amount;}
async function createDeposit(userId,value,provider=getProvider()){
 const amount=validAmount(value);const user=getDb().prepare('SELECT telegram_id FROM users WHERE telegram_id=?').get(userId);if(!user)throw new Error('User tidak ditemukan.');
 const reference=makeReference();const external=await provider.createPayment({reference,amount});
 getDb().prepare(`INSERT INTO deposits(reference,user_id,provider,provider_reference,amount,status,qr_string,payment_url,raw_response,expires_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)`).run(reference,userId,provider.name,external.reference,amount,external.qrString||null,external.paymentUrl||null,JSON.stringify(external.raw||{}),external.expiresAt||null);
 return{reference,amount,provider:provider.name,...external};
}
function creditVerified(row,verified){return getDb().transaction(()=>{
  const current=getDb().prepare('SELECT * FROM deposits WHERE id=?').get(row.id);if(!current)throw new Error('Deposit tidak ditemukan.');
  if(current.credited_at)return{status:'paid',duplicate:true,amount:current.amount,userId:current.user_id,reference:current.reference,balance:getDb().prepare('SELECT balance FROM users WHERE telegram_id=?').get(current.user_id).balance};
  if(verified.status!=='paid'){getDb().prepare('UPDATE deposits SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(verified.status,current.id);return{status:verified.status,userId:current.user_id,reference:current.reference,amount:current.amount};}
  if(Number(verified.amount)!==current.amount)throw new Error('Nominal deposit tidak cocok.');
  const claimed=getDb().prepare("UPDATE deposits SET status='paid',credited_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND credited_at IS NULL").run(current.id);if(claimed.changes!==1)throw new Error('Deposit sedang/sudah diproses.');
  getDb().prepare('UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').run(current.amount,current.user_id);
  const balance=getDb().prepare('SELECT balance FROM users WHERE telegram_id=?').get(current.user_id).balance;
  getDb().prepare('INSERT INTO balance_logs(user_id,amount,balance_after,note,admin_id) VALUES(?,?,?,?,NULL)').run(current.user_id,current.amount,balance,`Deposit ${current.reference}`);
  return{status:'paid',duplicate:false,amount:current.amount,userId:current.user_id,reference:current.reference,balance};
 }).immediate();}
async function checkDeposit(reference,userId){const row=getDb().prepare('SELECT * FROM deposits WHERE reference=? AND user_id=?').get(reference,userId);if(!row)throw new Error('Deposit tidak ditemukan.');if(row.credited_at)return creditVerified(row,{status:'paid',amount:row.amount});const verified=await getProvider(row.provider).checkPayment(row.provider_reference,row.amount);return creditVerified(row,verified);}
async function handleDepositWebhook(providerName,payload){const verified=await getProvider(providerName).handleWebhook(payload);const row=getDb().prepare('SELECT * FROM deposits WHERE provider=? AND provider_reference=?').get(providerName,verified.reference);if(!row)return null;return creditVerified(row,verified);}
function recentDeposits(userId,limit=10){return getDb().prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY id DESC LIMIT ?').all(userId,limit);}
module.exports={MIN_DEPOSIT,createDeposit,checkDeposit,handleDepositWebhook,recentDeposits};
