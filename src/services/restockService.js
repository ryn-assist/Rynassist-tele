const { getDb } = require('../database');
function toggle(userId, variantId) {
  return getDb().transaction(() => {
    const existing = getDb().prepare('SELECT 1 FROM restock_variant_subscriptions WHERE user_id=? AND variant_id=?').get(userId, variantId);
    if (existing) { getDb().prepare('DELETE FROM restock_variant_subscriptions WHERE user_id=? AND variant_id=?').run(userId, variantId); return false; }
    getDb().prepare('INSERT INTO restock_variant_subscriptions(user_id,variant_id) VALUES(?,?)').run(userId, variantId); return true;
  }).immediate();
}
function takeSubscribers(variantId) {
  return getDb().transaction(() => {
    const rows = getDb().prepare('SELECT user_id FROM restock_variant_subscriptions WHERE variant_id=?').all(variantId);
    getDb().prepare('DELETE FROM restock_variant_subscriptions WHERE variant_id=?').run(variantId);
    return rows;
  })();
}
module.exports = { toggle, takeSubscribers };
