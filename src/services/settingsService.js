const { getDb } = require('../database');
const { config } = require('../config');

function get(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key=?').get(String(key));
  return row ? row.value : fallback;
}
function set(key, value) {
  getDb().prepare(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(String(key), String(value));
  return String(value);
}
function remove(key) { return getDb().prepare('DELETE FROM settings WHERE key=?').run(String(key)).changes > 0; }
function bannerUrl() { return get('banner_url', config.bannerUrl || ''); }
function bannerEnabled() { return get('banner_enabled', bannerUrl() ? '1' : '0') === '1'; }
function setBannerEnabled(enabled) { set('banner_enabled', enabled ? '1' : '0'); return enabled; }
function setBannerUrl(url) { const value=String(url||'').trim(); set('banner_url', value); if(value) set('banner_enabled','1'); return value; }
module.exports={get,set,remove,bannerUrl,bannerEnabled,setBannerEnabled,setBannerUrl};
