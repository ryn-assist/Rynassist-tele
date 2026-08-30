const { config } = require('../config');

function ensureConfig() { if (!config.pakasirSlug || !config.pakasirApiKey) throw new Error('PAKASIR_SLUG dan PAKASIR_API_KEY wajib diisi.'); }
async function request(path, options={}) { const response=await fetch(`https://app.pakasir.com${path}`,options); const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.message||`Pakasir HTTP ${response.status}`); return data; }
module.exports={
 name:'pakasir',
 async createPayment({reference,amount}){ensureConfig();const data=await request('/api/transactioncreate/qris',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:config.pakasirSlug,order_id:reference,amount,api_key:config.pakasirApiKey})});const tx=data.transaction||data;return {reference:tx.order_id||reference,qrString:tx.payment_number||tx.qr_string,paymentUrl:tx.payment_url,expiresAt:tx.expired_at,raw:data};},
 async checkPayment(reference,amount){ensureConfig();const query=new URLSearchParams({project:config.pakasirSlug,order_id:reference,amount:String(amount),api_key:config.pakasirApiKey});const data=await request(`/api/transactiondetail?${query}`);const tx=data.transaction||data;return {reference,status:map(tx.status),amount:Number(tx.amount||amount),raw:data};},
 async handleWebhook(payload){if(payload.project&&String(payload.project)!==config.pakasirSlug)throw new Error('Webhook Pakasir tidak valid.');return this.checkPayment(String(payload.order_id),Number(payload.amount));},
 async cancelPayment(reference,amount){ensureConfig();const data=await request('/api/transactioncancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:config.pakasirSlug,order_id:reference,amount,api_key:config.pakasirApiKey})});return {reference,status:'cancelled',raw:data};}
};
function map(status=''){const s=String(status).toLowerCase();if(['completed','success','paid'].includes(s))return'paid';if(['expired'].includes(s))return'expired';if(['cancelled','canceled'].includes(s))return'cancelled';if(['failed'].includes(s))return'failed';return'pending';}
