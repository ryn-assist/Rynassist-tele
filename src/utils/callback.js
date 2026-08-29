const crypto = require('node:crypto');
const { config } = require('../config');

function signature(userId, action, productId) {
  return crypto.createHmac('sha256', config.botToken).update(`${userId}:${action}:${productId}`).digest('hex').slice(0, 12);
}

function productCallback(userId, action, productId) {
  return `${action}:${productId}:${signature(userId, action, productId)}`;
}

function isValidProductCallback(userId, action, productId, supplied) {
  const expected = signature(userId, action, productId);
  const left = Buffer.from(expected); const right = Buffer.from(String(supplied));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = { productCallback, isValidProductCallback };
