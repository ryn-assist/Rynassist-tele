const { getDb } = require('../database');
function toggle(userId, variantId) {
  return getDb().transaction(() => {
    const existing = getDb().prepare('SELECT 1 FROM restock_variant_subscriptions WHERE user_id=? AND variant_id=?').get(userId, variantId);
    if (existing) { getDb().prepare('DELETE FROM restock_variant_subscriptions WHERE user_id=? AND variant_id=?').run(userId, variantId); return false; }
    getDb().prepare('INSERT INTO restock_variant_subscriptions(user_id,variant_id) VALUES(?,?)').run(userId, variantId); return true;
  }).immediate();
}
function takeSubscribers(productId) {
  return getDb().transaction(() => {
    const rows = getDb().prepare('SELECT user_id FROM restock_subscriptions WHERE product_id=?').all(productId);
    getDb().prepare('DELETE FROM restock_subscriptions WHERE product_id=?').run(productId);
    return rows;
  })();
}
function readyVariantSubscribers(){return getDb().prepare(`SELECT s.user_id,s.variant_id,v.name variant_name,p.name product_name,COUNT(st.id) stock FROM restock_variant_subscriptions s JOIN product_variants v ON v.id=s.variant_id JOIN products p ON p.id=v.product_id LEFT JOIN stock_items st ON st.variant_id=v.id AND st.status='available' GROUP BY s.user_id,s.variant_id HAVING stock>0`).all();}
function removeVariantSubscriber(userId,variantId){return getDb().prepare('DELETE FROM restock_variant_subscriptions WHERE user_id=? AND variant_id=?').run(userId,variantId).changes>0;}
module.exports = { toggle, takeSubscribers, readyVariantSubscribers, removeVariantSubscriber };
