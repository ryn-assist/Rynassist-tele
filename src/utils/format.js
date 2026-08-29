const { config } = require('../config');

function money(value) {
  return `${config.currency}${Number(value).toLocaleString('id-ID')}`;
}
function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
module.exports = { money, escapeHtml };
