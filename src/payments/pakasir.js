const { config } = require('../config');

function ensureConfig() { if (!config.pakasirSlug || !config.pakasirApiKey) throw new Error('PAKASIR_SLUG dan PAKASIR_API_KEY wajib diisi.'); }
async function request(path, options={}) { const response=await fetch(`https://app.pakasir.com${path}`,options); const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.message||`Pakasir HTTP ${response.status}`); return data; }
function deepValues(value, out=[]) { if (value == null) return out; if (typeof value === 'string') out.push(value); else if (Array.isArray(value)) for (const item of value) deepValues(item,out); else if (typeof value === 'object') for (const item of Object.values(value)) deepValues(item,out); return out; }
function pickQr(data, tx) {
 const candidates=[tx?.payment_number,tx?.qr_string,tx?.qr_content,tx?.qris,tx?.qris_string,tx?.qr_code,tx?.qr_code_string,data?.payment_number,data?.qr_string,data?.qr_content,data?.qris,data?.qris_string,data?.qr_code,data?.qr_code_string].filter(Boolean).map(String);
 const all=[...candidates,...deepValues(data)];
 return all.find(v=>/^000201/.test(v.trim())) || candidates.find(v=>v.length>80 && !/^https?:\/\//i.test(v.trim())) || null;
}
function pickUrl(data, tx) {
 const candidates=[tx?.payment_url,tx?.qr_url,tx?.qris_url,data?.payment_url,data?.qr_url,data?.qris_url,...deepValues(data)].filter(Boolean).map(String);
 return candidates.find(v=>/^https?:\/\//i.test(v.trim()) && /(qr|qris|payment|checkout)/i.test(v)) || null;
}
module.exports={
 name:'pakasir',
 async createPayment({reference,amount}){ensureConfig();const data=await request('/api/transactioncreate/qris',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:config.pakasirSlug,order_id:reference,amount,api_key:config.pakasirApiKey})});const tx=data.transaction||data;return {reference:tx.order_id||reference,qrString:pickQr(data,tx),paymentUrl:pickUrl(data,tx),expiresAt:tx.expired_at||tx.expires_at||data.expired_at||data.expires_at,raw:data};},
 async checkPayment(reference,amount){ensureConfig();const query=new URLSearchParams({project:config.pakasirSlug,order_id:reference,amount:String(amount),api_key:config.pakasirApiKey});const data=await request(`/api/transactiondetail?${query}`);const tx=data.transaction||data;return {reference,status:map(tx.status),amount:Number(tx.amount||amount),raw:data};},
 async handleWebhook(payload){if(payload.project&&String(payload.project)!==config.pakasirSlug)throw new Error('Webhook Pakasir tidak valid.');return this.checkPayment(String(payload.order_id),Number(payload.amount));},
 async cancelPayment(reference,amount){ensureConfig();const data=await request('/api/transactioncancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:config.pakasirSlug,order_id:reference,amount,api_key:config.pakasirApiKey})});return {reference,status:'cancelled',raw:data};}
};
function map(status=''){const s=String(status).toLowerCase();if(['completed','success','paid'].includes(s))return'paid';if(['expired'].includes(s))return'expired';if(['cancelled','canceled'].includes(s))return'cancelled';if(['failed'].includes(s))return'failed';return'pending';}
