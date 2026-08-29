const TELEGRAM_ID_PATTERN = /^\d{1,20}$/;
const PRODUCT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

function requirePositiveInteger(value, label = 'Nilai') {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} harus bilangan bulat positif.`);
  return number;
}

function requireNonNegativeInteger(value, label = 'Nilai') {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} harus bilangan bulat non-negatif.`);
  return number;
}

function requireTelegramId(value) {
  const text = String(value ?? '').trim();
  if (!TELEGRAM_ID_PATTERN.test(text)) throw new Error('Telegram user ID tidak valid.');
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Telegram user ID berada di luar rentang aman.');
  return number;
}

function requireText(value, label, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  if (text.length > maxLength) throw new Error(`${label} maksimal ${maxLength} karakter.`);
  return text;
}

function requireProductCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!PRODUCT_CODE_PATTERN.test(code)) throw new Error('Kode produk hanya boleh berisi huruf, angka, _ atau - (maksimal 32 karakter).');
  return code;
}

module.exports = { requirePositiveInteger, requireNonNegativeInteger, requireTelegramId, requireText, requireProductCode };
