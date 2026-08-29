const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.BOT_TOKEN = 'test-token-not-a-real-secret';
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rynassist-menu-')), 'test.db');

const { getDb, closeDb } = require('../src/database');
const productService = require('../src/services/productService');
const userService = require('../src/services/userService');
const { MAIN_KEYBOARD_ROWS, mainKeyboard } = require('../src/keyboards/main');
const { registerStart } = require('../src/commands/start');
const { registerMainMenuHandlers } = require('../src/handlers/mainMenuHandler');
const { registerAccountHandlers } = require('../src/handlers/accountHandler');
const { BOT_COMMANDS } = require('../src/config/botCommands');

function mockBot() {
  const handlers = { commands: new Map(), hears: [] };
  return {
    handlers,
    start(handler) { handlers.commands.set('start', handler); },
    command(name, handler) { handlers.commands.set(name, handler); },
    action() {},
    hears(pattern, handler) { handlers.hears.push({ pattern, handler }); }
  };
}

function context(text = '') {
  const replies = [];
  return {
    from: { id: 500, first_name: 'Tester' },
    message: { text },
    session: { quantities: {} },
    replies,
    reply(message, extra) { replies.push({ message, extra }); return Promise.resolve(); }
  };
}

function hearHandler(bot, text) {
  return bot.handlers.hears.find(({ pattern }) => typeof pattern === 'string' ? pattern === text : pattern.test(text)).handler;
}

test('reply keyboard utama permanen memiliki susunan yang diminta', () => {
  assert.equal(MAIN_KEYBOARD_ROWS.length, 8);
  assert.deepEqual(MAIN_KEYBOARD_ROWS[0], ['🏷️ List Produk', '📮 Voucher', '🗂️ Laporan Stok']);
  assert.deepEqual(MAIN_KEYBOARD_ROWS[7], ['⚠️ Information', '📜 Riwayat']);
  assert.deepEqual(MAIN_KEYBOARD_ROWS.slice(1, 6).flat(), Array.from({ length: 25 }, (_, index) => String(index + 1)));
  const markup = mainKeyboard().reply_markup;
  assert.equal(markup.resize_keyboard, true);
  assert.equal(markup.is_persistent, true);
  assert.equal(markup.one_time_keyboard, false);
});

test('/start dan /menu menampilkan welcome beserta reply keyboard', async () => {
  const bot = mockBot(); registerStart(bot);
  for (const command of ['start', 'menu']) {
    const ctx = context(); await bot.handlers.commands.get(command)(ctx);
    assert.match(ctx.replies[0].message, /RynAssist/);
    assert.equal(ctx.replies[0].extra.reply_markup.is_persistent, true);
  }
});

test('List Produk, tombol angka global, nomor kosong, dan detail inline tetap bekerja', async () => {
  userService.upsertUser({ id: 500, first_name: 'Tester' });
  const productId = productService.createProduct({ code: 'MENU_ONE', name: 'Produk Pertama', price: 1000, description: 'Test' });
  productService.addStock(productId, ['STOCK-ONE']);
  const bot = mockBot(); registerMainMenuHandlers(bot);

  const listCtx = context('🏷️ List Produk'); await hearHandler(bot, listCtx.message.text)(listCtx);
  assert.match(listCtx.replies[0].message, /List Produk/);
  assert.ok(listCtx.replies[0].extra.reply_markup.inline_keyboard);

  const firstCtx = context('1'); await hearHandler(bot, '1')(firstCtx);
  assert.match(firstCtx.replies[0].message, /Produk Pertama/);
  assert.ok(firstCtx.replies[0].extra.reply_markup.inline_keyboard);
  assert.equal(firstCtx.session.activeProductId, productId);

  const emptyCtx = context('25'); await hearHandler(bot, '25')(emptyCtx);
  assert.equal(emptyCtx.replies[0].message, 'Produk nomor tersebut belum tersedia.');
});

test('Riwayat dan command menu Telegram tersedia', async () => {
  const bot = mockBot(); registerMainMenuHandlers(bot); registerAccountHandlers(bot);
  const historyCtx = context('📜 Riwayat'); await hearHandler(bot, historyCtx.message.text)(historyCtx);
  assert.match(historyCtx.replies[0].message, /Belum ada transaksi/);
  assert.deepEqual(BOT_COMMANDS.map(({ command }) => command), ['start', 'menu', 'products', 'wallet', 'orders', 'help']);
});

test.after(() => closeDb());
