const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

function parseAdminIds(value = '') {
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  const invalid = ids.find((id) => !/^\d{1,20}$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0);
  if (invalid) throw new Error(`ADMIN_IDS berisi Telegram ID tidak valid: ${invalid}`);
  return new Set(ids);
}

const config = {
  botToken: process.env.BOT_TOKEN,
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/rynassist.db'),
  storeName: process.env.STORE_NAME || 'RynAssist',
  currency: process.env.CURRENCY || 'Rp'
};

function validateConfig() {
  if (!config.botToken) throw new Error('BOT_TOKEN wajib diisi di file .env');
  if (config.adminIds.size === 0) console.warn('Peringatan: ADMIN_IDS kosong; fitur admin tidak dapat digunakan.');
}

module.exports = { config, validateConfig, parseAdminIds };
