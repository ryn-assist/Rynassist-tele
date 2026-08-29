const { Markup } = require('telegraf');
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 List Produk', 'products:1')],
    [Markup.button.callback('💰 Saldo Saya', 'account:balance'), Markup.button.callback('🧾 Riwayat', 'account:orders')]
  ]);
}
module.exports = { mainKeyboard };
