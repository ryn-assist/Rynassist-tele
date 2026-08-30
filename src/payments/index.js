const { config }=require('../config');
function getProvider(name=config.paymentProvider){if(name==='pakasir')return require('./pakasir');if(name==='midtrans')return require('./midtrans');throw new Error(`PAYMENT_PROVIDER tidak didukung: ${name}`);}
module.exports={getProvider};
