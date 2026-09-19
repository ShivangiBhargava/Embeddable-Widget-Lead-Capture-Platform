const crypto = require('node:crypto');
const { read, hash } = require('./store');
const secret = () => process.env.TOKEN_SECRET || 'local-demo-only-change-me';
const base64 = (value) => Buffer.from(value).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
function issue(user) { const payload = base64(JSON.stringify({ sub: user.id, tenantId: user.tenantId, exp: Date.now() + 8 * 3600_000 })); return `${payload}.${sign(payload)}`; }
function verify(header) {
  const token = header?.replace(/^Bearer\s+/i, ''); if (!token) return null;
  const [payload, signature] = token.split('.'); if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  try { const claims = JSON.parse(Buffer.from(payload, 'base64url')); return claims.exp > Date.now() ? claims : null; } catch { return null; }
}
function login(email, password) { const user = read().users.find((entry) => entry.email === String(email).toLowerCase() && entry.passwordHash === hash(password || '')); return user ? { token: issue(user), user: { id: user.id, email: user.email, tenantId: user.tenantId } } : null; }
module.exports = { verify, login };
