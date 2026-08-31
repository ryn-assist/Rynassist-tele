function formatNumber(value){return Number(value||0).toLocaleString('id-ID');}
function formatWib(date=new Date()){
  const parts=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  const get=(type)=>parts.find(p=>p.type===type)?.value||'';
  return `${get('day')} ${get('month')} ${get('year')} pukul ${get('hour')}.${get('minute')}`;
}
function methodLabel(method){return String(method||'').toLowerCase()==='balance'?'Saldo':'QRIS auto';}
function stockDetail(stock,index){
  const content=String(stock?.content??'').trim();
  const separator=content.indexOf('|');
  const email=separator>=0?content.slice(0,separator).trim():content;
  const password=separator>=0?content.slice(separator+1).trim():'';
  return `${index+1}. Email : ${email}\n- password : ${password}`;
}
function transactionSuccessText(data){
  const stocks=Array.isArray(data.stocks)?data.stocks:[];
  const details=stocks.map(stockDetail).join('\n');
  return `╭────〔 TRANSAKSI SUKSES 〕─\n\n┊・Pay ID : ${data.orderId ?? '-'}\n┊・Kode Unik : ${data.invoice || '-'}\n┊・Nama Produk : ${data.productName || '-'}\n┊・Nama Variasi : ${data.variantName || '-'}\n┊・ID Buyer : ${data.userId ?? '-'}\n┊・Nomor Buyer : ${data.buyerNumber || '-'}\n┊・Jumlah Beli : ${data.quantity ?? stocks.length}\n┊・Berhasil Dipenuhi : ${stocks.length} akun\n┊・Harga Terpakai : ${formatNumber(data.unitPrice)}\n┊・Fee : ${data.fee == null ? '-' : formatNumber(data.fee)}\n┊・Total Dibayar : ${formatNumber(data.total)}\n┊・Methode Pay : ${methodLabel(data.paymentMethod)}\n┊・Tanggal/Jam Transaksi : ${formatWib()}\n╰┈┈┈┈┈┈┈┈\n〔 *PRODUCT DETAIL* 〕\n${details || '1. Email :\n- password : '}`;
}
module.exports={transactionSuccessText,formatWib,stockDetail};
