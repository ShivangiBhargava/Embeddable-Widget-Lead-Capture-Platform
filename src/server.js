const http = require('node:http'); const { URL } = require('node:url');
const { seed, read, transaction } = require('./store'); const { verify, login } = require('./auth');
const svc = require('./services');
const landingPage = require('./ui');
seed();
function send(res, status, body, headers = {}) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
function publicHeaders(extra = {}) { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type, Idempotency-Key, X-Force-Side-Effect-Fail', 'access-control-max-age': '600', ...extra }; }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', (chunk) => { raw += chunk; if (raw.length > svc.MAX_BODY) { const error = Error('too large'); error.code = 413; req.destroy(error); } }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { const error = Error('invalid JSON'); error.code = 400; reject(error); } }); req.on('error', reject); }); }
function auth(req, res) { const claims = verify(req.headers.authorization); if (!claims) { send(res, 401, { error: 'authentication required' }); return null; } return claims; }
function widgetView(widget) { const { tenantId, ...safe } = widget; return safe; }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`); const path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {}, publicHeaders());
  try {
    if (req.method === 'GET' && path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(landingPage); }
    if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'POST' && path === '/auth/login') { const input = await body(req); const result = login(input.email, input.password); return result ? send(res, 200, result) : send(res, 401, { error: 'invalid credentials' }); }
    if (req.method === 'GET' && path === '/widget.v1.js') { const js = require('./widget-bundle'); res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' }); return res.end(js); }
    const configMatch = path.match(/^\/public\/widgets\/([^/]+)\/config$/);
    if (req.method === 'GET' && configMatch) { const widget = read().widgets.find((row) => row.id === configMatch[1]); return widget ? send(res, 200, widgetView(widget), publicHeaders({ 'cache-control': 'public, max-age=300' })) : send(res, 404, { error: 'widget not found' }, publicHeaders()); }
    if (req.method === 'POST' && path === '/public/submissions') { const input = await body(req); const widget = read().widgets.find((row) => row.id === input.widgetId); if (!widget) return send(res, 404, { error: 'widget not found' }, publicHeaders()); const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'; if (!svc.checkRate(`${ip}:${widget.id}`)) return send(res, 429, { error: 'rate limit exceeded; retry in one minute' }, publicHeaders()); if (input.honeypot) return send(res, 422, { error: 'spam detected' }, publicHeaders()); const errors = svc.validateSubmission(widget, input); if (errors.length) return send(res, errors.some((x) => x.includes('16KB')) ? 413 : 422, { error: 'validation failed', details: errors }, publicHeaders()); const stored = svc.storeSubmission({ widget, body: input, clientIp: ip, idempotencyKey: req.headers['idempotency-key'] }); if (!stored.replay) { const geo = await svc.geo(ip); svc.enrich(stored.submission.id, geo); svc.processJobs(req.headers['x-force-side-effect-fail'] === 'true'); } return send(res, stored.replay ? 200 : 201, { id: stored.submission.id, status: 'accepted', idempotentReplay: stored.replay }, publicHeaders()); }
    if (!path.startsWith('/admin/')) return send(res, 404, { error: 'not found' });
    const claims = auth(req, res); if (!claims) return;
    if (req.method === 'GET' && path === '/admin/widgets') return send(res, 200, { items: read().widgets.filter((row) => row.tenantId === claims.tenantId).map(widgetView) });
    if (req.method === 'POST' && path === '/admin/widgets') { const result = svc.createWidget(claims.tenantId, await body(req)); return result.errors ? send(res, 422, { error: 'validation failed', details: result.errors }) : send(res, 201, widgetView(result.value)); }
    const widgetMatch = path.match(/^\/admin\/widgets\/([^/]+)$/);
    if (widgetMatch) { const widget = read().widgets.find((row) => row.id === widgetMatch[1] && row.tenantId === claims.tenantId); if (!widget) return send(res, 404, { error: 'widget not found' }); if (req.method === 'GET') return send(res, 200, widgetView(widget)); if (req.method === 'PUT') { const result = svc.updateWidget(claims.tenantId, widget.id, await body(req)); return result.errors ? send(res, 422, { error: 'validation failed', details: result.errors }) : send(res, 200, widgetView(result.value)); } if (req.method === 'DELETE') { transaction((db) => { db.widgets = db.widgets.filter((row) => !(row.id === widget.id && row.tenantId === claims.tenantId)); }); return send(res, 204, {}); } }
    if (req.method === 'GET' && path === '/admin/submissions') { const rows = read().submissions.filter((row) => row.tenantId === claims.tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return send(res, 200, { items: rows }); }
    if (req.method === 'GET' && path === '/admin/dashboard/stats') { const rows = read().submissions.filter((row) => row.tenantId === claims.tenantId); const byWidget = {}; const byCountry = {}; const byDay = {}; for (const row of rows) { byWidget[row.widgetId] = (byWidget[row.widgetId] || 0) + 1; if (row.geo?.country) byCountry[row.geo.country] = (byCountry[row.geo.country] || 0) + 1; const day = row.createdAt.slice(0, 10); byDay[day] = (byDay[day] || 0) + 1; } return send(res, 200, { total: rows.length, byWidget, byCountry, byDay }); }
    return send(res, 404, { error: 'not found' });
  } catch (error) { if (error.code === 413) return send(res, 413, { error: 'payload too large' }, publicHeaders()); if (error.code === 400) return send(res, 400, { error: 'invalid JSON' }, publicHeaders()); console.error('request failure', error.message); return send(res, 500, { error: 'internal server error' }, publicHeaders()); }
});
if (require.main === module) server.listen(Number(process.env.PORT || 3000), () => console.log(`Lead platform listening on ${process.env.PORT || 3000}`));
module.exports = { server };
