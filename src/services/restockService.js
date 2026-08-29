const { getDb } = require('../database');
function toggle(userId, productId) {
  return getDb().transaction(() => {
    const existing = getDb().prepare('SELECT 1 FROM restock_subscriptions WHERE user_id=? AND product_id=?').get(userId, productId);
    if (existing) { getDb().prepare('DELETE FROM restock_subscriptions WHERE user_id=? AND product_id=?').run(userId, productId); return false; }
    getDb().prepare('INSERT INTO restock_subscriptions(user_id,product_id) VALUES(?,?)').run(userId, productId); return true;
  }).immediate();
}
function takeSubscribers(productId) {
  return getDb().transaction(() => {
    const rows = getDb().prepare('SELECT user_id FROM restock_subscriptions WHERE product_id=?').all(productId);
    getDb().prepare('DELETE FROM restock_subscriptions WHERE product_id=?').run(productId);
    return rows;
  })();
}
module.exports = { toggle, takeSubscribers };
