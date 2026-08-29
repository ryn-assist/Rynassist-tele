const { getDb } = require('../database');

function upsertUser(from) {
  getDb().prepare(`INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=CURRENT_TIMESTAMP`)
    .run(from.id, from.username || null, from.first_name || '');
  return getUser(from.id);
}
function getUser(id) { return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(id); }
function listUsers(limit = 30) { return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').all(limit); }

function adjustBalance(userId, amount, note, adminId) {
  return getDb().transaction(() => {
    const user = getUser(userId);
    if (!user) throw new Error('User tidak ditemukan. User harus pernah membuka bot.');
    const next = user.balance + amount;
    if (!Number.isSafeInteger(next)) throw new Error('Saldo hasil penyesuaian berada di luar rentang aman.');
    if (next < 0) throw new Error('Saldo user tidak mencukupi untuk pengurangan tersebut.');
    getDb().prepare('UPDATE users SET balance=?, updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').run(next, userId);
    getDb().prepare('INSERT INTO balance_logs (user_id, amount, balance_after, note, admin_id) VALUES (?, ?, ?, ?, ?)')
      .run(userId, amount, next, note, adminId);
    return next;
  })();
}
module.exports = { upsertUser, getUser, listUsers, adjustBalance };
