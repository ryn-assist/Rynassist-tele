const crypto=require('node:crypto');
const {getDb}=require('../database');
const {getProvider}=require('../payments');
const MIN_DEPOSIT=1000;
function makeReference(){return `DEP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;}
function validAmount(value){const raw=String(value??'').trim().replace(/[._\s]/g,'');if(!/^\d+$/.test(raw))throw new Error('Nominal deposit harus berupa angka positif.');const amount=Number(raw);if(!Number.isSafeInteger(amount)||amount<MIN_DEPOSIT)throw new Error(`Minimal deposit Rp${MIN_DEPOSIT.toLocaleString('id-ID')}.`);return amount;}
async function createDeposit(userId,value,provider=getProvider()){
 const amount=validAmount(value);const user=getDb().prepare('SELECT telegram_id FROM users WHERE telegram_id=?').get(userId);if(!user)throw new Error('User tidak ditemukan.');
 const reference=makeReference();const external=await provider.createPayment({reference,amount});
 getDb().prepare(`INSERT INTO deposits(reference,user_id,provider,provider_reference,amount,status,qr_string,payment_url,raw_response,expires_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)`).run(reference,userId,provider.name,external.reference,amount,external.qrString||null,external.paymentUrl||null,JSON.stringify(external.raw||{}),external.expiresAt||null);
 return{reference,amount,provider:provider.name,...external};
}
function creditVerified(row,verified){return getDb().transaction(()=>{
  const current=getDb().prepare('SELECT * FROM deposits WHERE id=?').get(row.id);if(!current)throw new Error('Deposit tidak ditemukan.');
  if(current.credited_at)return{status:'paid',duplicate:true,amount:current.amount,userId:current.user_id,reference:current.reference,balance:getDb().prepare('SELECT balance FROM users WHERE telegram_id=?').get(current.user_id).balance};
  if(current.status==='cancelled')return{status:'cancelled',duplicate:true,amount:current.amount,userId:current.user_id,reference:current.reference};
  if(verified.status!=='paid'){getDb().prepare('UPDATE deposits SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(verified.status,current.id);return{status:verified.status,userId:current.user_id,reference:current.reference,amount:current.amount};}
  if(Number(verified.amount)!==current.amount)throw new Error('Nominal deposit tidak cocok.');
  const claimed=getDb().prepare("UPDATE deposits SET status='paid',credited_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND credited_at IS NULL AND status!='cancelled'").run(current.id);if(claimed.changes!==1)throw new Error('Deposit sedang/sudah diproses.');
  getDb().prepare('UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').run(current.amount,current.user_id);
  const balance=getDb().prepare('SELECT balance FROM users WHERE telegram_id=?').get(current.user_id).balance;
  getDb().prepare('INSERT INTO balance_logs(user_id,amount,balance_after,note,admin_id) VALUES(?,?,?,?,NULL)').run(current.user_id,current.amount,balance,`Deposit ${current.reference}`);
  return{status:'paid',duplicate:false,amount:current.amount,userId:current.user_id,reference:current.reference,balance};
 }).immediate();}
async function checkDeposit(reference,userId){const row=getDb().prepare('SELECT * FROM deposits WHERE reference=? AND user_id=?').get(reference,userId);if(!row)throw new Error('Deposit tidak ditemukan.');if(row.status==='cancelled')return{status:'cancelled',duplicate:true,amount:row.amount,userId:row.user_id,reference:row.reference};if(row.credited_at)return creditVerified(row,{status:'paid',amount:row.amount});const verified=await getProvider(row.provider).checkPayment(row.provider_reference,row.amount);return creditVerified(row,verified);}
async function cancelDeposit(reference,userId){const row=getDb().prepare('SELECT * FROM deposits WHERE reference=? AND user_id=?').get(reference,userId);if(!row)throw new Error('Deposit tidak ditemukan.');if(row.status!=='pending'||row.credited_at)return false;const provider=getProvider(row.provider);if(typeof provider.cancelPayment!=='function')throw new Error('Provider tidak mendukung pembatalan pembayaran.');await provider.cancelPayment(row.provider_reference,row.amount);const changed=getDb().prepare("UPDATE deposits SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND credited_at IS NULL").run(row.id);return changed.changes===1;}
async function handleDepositWebhook(providerName,payload){const reference=String(payload?.order_id||'');if(!reference)return null;const row=getDb().prepare('SELECT * FROM deposits WHERE provider=? AND provider_reference=?').get(providerName,reference);if(!row)return null;const verified=await getProvider(providerName).handleWebhook(payload);return creditVerified(row,verified);}
function recentDeposits(userId,limit=10){return getDb().prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY id DESC LIMIT ?').all(userId,limit);}
module.exports={MIN_DEPOSIT,createDeposit,checkDeposit,cancelDeposit,handleDepositWebhook,recentDeposits,validAmount};
