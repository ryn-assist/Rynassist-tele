const { Markup } = require('telegraf');

const MAIN_KEYBOARD_ROWS = [
  ['🏷️ List Produk', '📮 Voucher', '🗂️ Laporan Stok'],
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '10'],
  ['11', '12', '13', '14', '15'],
  ['16', '17', '18', '19', '20'],
  ['21', '22', '23', '24', '25'],
  ['💰 Deposit', '❔ Cara Order'],
  ['⚠️ Information', '📜 Riwayat']
];

function mainKeyboard() {
  const keyboard = Markup.keyboard(MAIN_KEYBOARD_ROWS)
    .resize(true)
    .oneTime(false);
  keyboard.reply_markup.is_persistent = true;
  return keyboard;
}

module.exports = { MAIN_KEYBOARD_ROWS, mainKeyboard };
