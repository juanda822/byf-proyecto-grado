/*
 * Banco de pruebas: ejecuta las rutas y controladores reales del backend de B&F
 * sobre una base de datos SQLite en memoria (en lugar de MySQL) y con los correos
 * interceptados (en lugar de enviarlos por Brevo).
 */
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const BACKEND = process.env.BACKEND || path.resolve(__dirname, '..', 'backend');
process.env.AUTH_SECRET = 'secreto-de-prueba';
process.env.BREVO_API_KEY = 'clave-de-prueba';
process.env.MAIL_FROM = 'pqrs@byf.test';
process.env.ADMIN_NOTIFY_EMAIL = 'admin@byf.test';
process.env.SITE_URL = 'https://byf.test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'byf-uploads-'));

/* ------------------------------------------------ correos interceptados */
const correos = [];
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  correos.push({ url, to: body.to.map(t => t.email), subject: body.subject, html: body.htmlContent, adjuntos: (body.attachment || []).length });
  return { ok: true, status: 201, json: async () => ({ messageId: 'x' }), text: async () => '' };
};

/* ------------------------------------------------ MySQL → SQLite */
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');

function ddl(sql) {
  const [, table, body] = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*)\)\s*ENGINE/i.exec(sql);
  const out = [];
  for (let line of body.split('\n').map(l => l.trim().replace(/,$/, '')).filter(Boolean)) {
    if (/^KEY /i.test(line)) continue;
    if (/^PRIMARY KEY/i.test(line)) { if (!/AUTO_INCREMENT/i.test(body)) out.push(line); continue; }
    let m;
    if ((m = /^UNIQUE KEY \w+ \((.+)\)/i.exec(line))) { out.push(`UNIQUE (${m[1]})`); continue; }
    if ((m = /^CONSTRAINT \w+ (FOREIGN KEY .*)/i.exec(line))) { out.push(m[1]); continue; }
    if (/AUTO_INCREMENT/i.test(line)) { out.push(`${line.split(/\s+/)[0]} INTEGER PRIMARY KEY AUTOINCREMENT`); continue; }
    line = line.replace(/ENUM\([^)]*\)/i, 'TEXT').replace(/\bUNSIGNED\b/gi, '')
      .replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '').replace(/DEFAULT CURRENT_TIMESTAMP/gi, "DEFAULT (datetime('now'))");
    out.push(line);
  }
  return `CREATE TABLE ${table} (${out.join(', ')})`;
}
const schema = fs.readFileSync(path.join(BACKEND, 'database', 'schema.sql'), 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(s => s.trim())
  .filter(s => /^CREATE TABLE/i.test(s));
for (const s of schema) sqlite.exec(ddl(s));

function translate(sql) {
  return sql
    .replace(/DATE_ADD\(NOW\(\), INTERVAL \? MINUTE\)/gi, "datetime('now', '+' || ? || ' minutes')")
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/\s+FOR UPDATE/gi, '')
    .replace(/INSERT IGNORE/gi, 'INSERT OR IGNORE')
    .replace(/ON DUPLICATE KEY UPDATE valor = VALUES\(valor\)/gi, 'ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime(\'now\')')
    .replace(/ LIKE \?/g, " LIKE ? ESCAPE '\\'");
}
function run(sql, params = []) {
  const args = params.map(p => (typeof p === 'boolean' ? Number(p) : p instanceof Date ? p.toISOString() : p));
  const stmt = sqlite.prepare(translate(sql));
  try {
    if (/^\s*SELECT/i.test(sql)) return stmt.all(...args);
    const r = stmt.run(...args);
    return { insertId: Number(r.lastInsertRowid), affectedRows: r.changes };
  } catch (e) {
    if (/UNIQUE constraint/.test(e.message)) throw Object.assign(new Error(e.message), { code: 'ER_DUP_ENTRY' });
    throw e;
  }
}
const fakeDb = {
  init: async () => {}, isReady: () => true, getLastError: () => null,
  query: async (sql, params) => run(sql, params),
  transaction: async work => {
    sqlite.exec('BEGIN');
    try { const r = await work({ query: async (s, p) => run(s, p) }); sqlite.exec('COMMIT'); return r; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  }
};
// Datos iniciales equivalentes a los de config/db.js (cargos y textos)
const CARGOS = ['Auxiliar contable', 'Operario(a) de confección', 'Operario(a) de bordado'];
CARGOS.forEach((n, i) => run('INSERT INTO cargos (nombre, area, orden) VALUES (?, ?, ?)', [n, 'Producción', i + 1]));
run('INSERT INTO contenido (clave, valor) VALUES (?, ?)', ['trabaja_titulo', 'Trabaja con nosotros']);

/* ------------------------------------------------ express mínimo */
function Router() {
  const stack = [];
  const r = { stack, use: (...h) => (stack.push({ method: '*', path: null, handlers: h }), r) };
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) r[m] = (p, ...h) => (stack.push({ method: m.toUpperCase(), path: p, handlers: h }), r);
  return r;
}
const expressShim = Object.assign(() => ({}), { Router, json: () => (q, s, n) => n(), static: () => (q, s, n) => n() });

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'express') return expressShim;
  if (request === 'mysql2/promise') return {};
  return origLoad.apply(this, arguments);
};
require.cache[require.resolve(path.join(BACKEND, 'config', 'db.js'))] = { exports: fakeDb, loaded: true, id: 'db' };

const mounts = {
  '/api/pqrs': require(path.join(BACKEND, 'routes', 'pqrsRoutes.js')),
  '/api/empleo': require(path.join(BACKEND, 'routes', 'empleoRoutes.js')),
  '/api/contenido': require(path.join(BACKEND, 'routes', 'contenidoRoutes.js'))
};

function match(pattern, p) {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  const m = re.exec(p); if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}

/** Envía una solicitud HTTP simulada a la API y devuelve { status, body, headers }. */
const bitacora = [];
async function api(method, url, opts = {}) {
  const r = await apiRaw(method, url, opts);
  const msg = r.body && typeof r.body === 'object' && !Buffer.isBuffer(r.body) ? (r.body.message || (r.body.data && r.body.data.codigo) || '') : (Buffer.isBuffer(r.body) ? `archivo de ${r.body.length} bytes (${r.headers['content-type']})` : '');
  bitacora.push({ method, url: url.split('?')[0] + (url.includes('?') ? '?' + url.split('?')[1] : ''), rol: opts.rol || (opts.token ? 'con sesión' : 'sin sesión'), status: r.status, msg: String(msg) });
  return r;
}
async function apiRaw(method, url, { body, token, ip = '10.0.0.1' } = {}) {
  const u = new URL(url, 'http://local');
  const [prefix, router] = Object.entries(mounts).find(([p]) => u.pathname.startsWith(p + '/'));
  const sub = u.pathname.slice(prefix.length);
  const req = {
    method, path: sub, url: sub, body: body === undefined ? {} : JSON.parse(JSON.stringify(body)),
    query: Object.fromEntries(u.searchParams), params: {}, ip,
    headers: token ? { authorization: `Bearer ${token}` } : {}, get(h) { return this.headers[h.toLowerCase()]; }
  };
  return new Promise(resolve => {
    const res = {
      statusCode: 200, headers: {}, headersSent: false,
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, set(k, v) { this.setHeader(k, v); return this; },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b, headers: this.headers }); },
      send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b, headers: this.headers }); },
      end() { this.send(undefined); },
      sendFile(f, cb) {
        if (!fs.existsSync(f)) return cb(new Error('no existe'));
        this.headersSent = true; resolve({ status: this.statusCode, body: fs.readFileSync(f), headers: this.headers });
      }
    };
    const chain = [];
    for (const layer of router.stack) {
      if (layer.method === '*') { chain.push(...layer.handlers.map(h => [h, {}])); continue; }
      if (layer.method !== method) continue;
      const params = match(layer.path, sub);
      if (params) { chain.push(...layer.handlers.map(h => [h, params])); break; }
    }
    let i = 0;
    const next = err => {
      if (err) return resolve({ status: 500, body: { error: String(err) } });
      const item = chain[i++];
      if (!item) return resolve({ status: 404, body: { message: 'Ruta no encontrada' } });
      req.params = item[1];
      Promise.resolve(item[0](req, res, next)).catch(next);
    };
    next();
  });
}

module.exports = { api, bitacora, correos, run, sqlite, uploadDir: process.env.UPLOAD_DIR };
