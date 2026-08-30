const { Markup } = require('telegraf');
const { productCallback } = require('../utils/callback');

function productListKeyboard(result, popular = false) {
  const rows = [];
  const nav = [];
  if (result.page > 1) nav.push(Markup.button.callback('⬅️ Sebelumnya', `${popular ? 'popular' : 'products'}:${result.page - 1}`));
  if (result.page < result.pages) nav.push(Markup.button.callback('➡️ Selanjutnya', `${popular ? 'popular' : 'products'}:${result.page + 1}`));
  if (nav.length) rows.push(nav);
  return Markup.inlineKeyboard(rows);
}

function productDetailKeyboard(userId, productId, quantity, stock) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➖', productCallback(userId, 'minus', productId)), Markup.button.callback(String(quantity), 'noop'), Markup.button.callback('🔄', productCallback(userId, 'reset', productId)), Markup.button.callback('➕', productCallback(userId, 'plus', productId))],
    [Markup.button.callback('Buy (Saldo)', productCallback(userId, 'balance', productId)), Markup.button.callback('Buy (Now)', productCallback(userId, 'now', productId))],
    ...(stock === 0 ? [[Markup.button.callback('🔔 Notif Restok', productCallback(userId, 'restock', productId))]] : []),
    [Markup.button.callback('⬅️ Kembali', 'products:1')]
  ]);
}
module.exports = { productListKeyboard, productDetailKeyboard };
