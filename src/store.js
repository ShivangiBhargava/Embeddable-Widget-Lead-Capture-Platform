const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = () => path.resolve(process.env.DATA_FILE || './data/platform.json');
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
function blank() { return { schemaVersion: 1, tenants: [], users: [], widgets: [], submissions: [], idempotency: {}, jobs: [] }; }
function read() {
  const target = file();
  if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); const db = blank(); fs.writeFileSync(target, JSON.stringify(db, null, 2)); return db; }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}
function write(db) { fs.writeFileSync(file(), JSON.stringify(db, null, 2)); }
function transaction(mutator) { const db = read(); const value = mutator(db); write(db); return value; }
function seed() {
  return transaction((db) => {
    if (db.tenants.length) return db;
    const createdAt = now();
    db.tenants.push({ id: 'tenant_alpha', name: 'Alpha Studio', createdAt }, { id: 'tenant_beta', name: 'Beta Labs', createdAt });
    db.users.push(
      { id: 'user_alpha', tenantId: 'tenant_alpha', email: 'owner@alpha.test', passwordHash: hash('demo-password') },
      { id: 'user_beta', tenantId: 'tenant_beta', email: 'owner@beta.test', passwordHash: hash('demo-password') }
    );
    const widget = { id: 'widget_welcome', tenantId: 'tenant_alpha', type: 'signup', title: 'Join the Alpha list', description: 'Monthly product notes. No spam.', fields: [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'name', label: 'Name', type: 'text', required: false }], buttonText: 'Subscribe', displayOptions: { theme: 'light' }, createdAt, updatedAt: createdAt };
    db.widgets.push(widget); return db;
  });
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
module.exports = { read, transaction, seed, id, now, hash };
