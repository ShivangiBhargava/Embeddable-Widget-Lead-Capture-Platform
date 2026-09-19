const { transaction, id, now } = require('./store');
const MAX_BODY = 16_384;
const rateBuckets = new Map();
function validateWidget(body) {
  const errors = []; if (!['signup', 'contact', 'cta', 'popover'].includes(body?.type)) errors.push('type must be signup, contact, cta, or popover');
  if (typeof body?.title !== 'string' || !body.title.trim() || body.title.length > 120) errors.push('title is required and limited to 120 characters');
  if (!Array.isArray(body?.fields) || body.fields.length < 1 || body.fields.length > 8) errors.push('fields must contain 1-8 fields');
  for (const field of body?.fields || []) if (!/^[a-z][a-z0-9_]{0,30}$/.test(field.name || '') || !['text', 'email', 'textarea'].includes(field.type) || typeof field.required !== 'boolean') errors.push('each field requires a safe name, type, and required flag');
  return errors;
}
function createWidget(tenantId, body) { const errors = validateWidget(body); if (errors.length) return { errors }; return { value: transaction((db) => { const stamp = now(); const widget = { id: id('widget'), tenantId, type: body.type, title: body.title.trim(), description: String(body.description || '').slice(0, 500), fields: body.fields, buttonText: String(body.buttonText || 'Submit').slice(0, 60), displayOptions: body.displayOptions || {}, createdAt: stamp, updatedAt: stamp }; db.widgets.push(widget); return widget; }) }; }
function updateWidget(tenantId, widgetId, body) { const errors = validateWidget(body); if (errors.length) return { errors }; return { value: transaction((db) => { const widget = db.widgets.find((entry) => entry.id === widgetId && entry.tenantId === tenantId); if (!widget) return null; Object.assign(widget, { type: body.type, title: body.title.trim(), description: String(body.description || '').slice(0, 500), fields: body.fields, buttonText: String(body.buttonText || 'Submit').slice(0, 60), displayOptions: body.displayOptions || {}, updatedAt: now() }); return widget; }) }; }
function checkRate(key) { const cutoff = Date.now() - 60_000; const bucket = (rateBuckets.get(key) || []).filter((stamp) => stamp > cutoff); if (bucket.length >= 8) { rateBuckets.set(key, bucket); return false; } bucket.push(Date.now()); rateBuckets.set(key, bucket); return true; }
async function geo(ip) {
  const aDown = process.env.GEO_PROVIDER_A_MODE === 'down'; const bDown = process.env.GEO_PROVIDER_B_MODE === 'down';
  if (!aDown) return { provider: 'mock-ip-api', country: 'India', city: 'Bengaluru', ip };
  if (!bDown) return { provider: 'mock-ipapi', country: 'India', city: 'Mumbai', ip };
  return null;
}
function validateSubmission(widget, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.data !== 'object' || Array.isArray(body.data)) return ['body.data must be an object'];
  if (JSON.stringify(body).length > MAX_BODY) return ['payload exceeds 16KB'];
  const allowed = new Set(widget.fields.map((field) => field.name)); const errors = [];
  for (const key of Object.keys(body.data)) if (!allowed.has(key)) errors.push(`unexpected field: ${key}`);
  for (const field of widget.fields) { const value = body.data[field.name]; if (field.required && (!value || !String(value).trim())) errors.push(`${field.name} is required`); if (value && String(value).length > 500) errors.push(`${field.name} is too long`); if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors.push(`${field.name} must be a valid email`); }
  return errors;
}
function storeSubmission({ widget, body, clientIp, idempotencyKey }) {
  return transaction((db) => { if (idempotencyKey && db.idempotency[idempotencyKey]) return { replay: true, submission: db.submissions.find((row) => row.id === db.idempotency[idempotencyKey]) }; const submission = { id: id('sub'), tenantId: widget.tenantId, widgetId: widget.id, payload: body.data, geo: null, status: 'accepted', createdAt: now() }; db.submissions.push(submission); if (idempotencyKey) db.idempotency[idempotencyKey] = submission.id; db.jobs.push({ id: id('job'), type: 'confirmation', submissionId: submission.id, attempts: 0, status: 'queued', createdAt: now() }); return { replay: false, submission }; });
}
function enrich(submissionId, geoValue) { return transaction((db) => { const row = db.submissions.find((entry) => entry.id === submissionId); if (row) row.geo = geoValue; return row; }); }
function processJobs(forceFail) { return transaction((db) => db.jobs.filter((job) => job.status === 'queued').map((job) => { job.attempts += 1; job.status = (forceFail || process.env.SIDE_EFFECT_MODE === 'fail') ? 'failed_safe' : 'sent'; return job; })); }
module.exports = { MAX_BODY, validateWidget, createWidget, updateWidget, checkRate, geo, validateSubmission, storeSubmission, enrich, processJobs };
