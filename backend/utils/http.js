/** Utilidades compartidas por los controladores que usan MySQL. */
const db = require('../config/db');

function clean(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function optional(value, max) {
  const v = clean(value, max);
  return v === '' ? null : v;
}

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Envuelve un controlador async y traduce los errores a respuestas JSON. */
const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe un registro con ese nombre.' });
    }
    const status = error.status || 500;
    if (status >= 500) console.error('[API]', error);
    res.status(status).json({
      success: false,
      message: status >= 500 && status !== 503 ? 'Ocurrió un error en el servidor.' : error.message
    });
  }
};

/** Responde 503 si MySQL no está conectado. */
function requireDb(req, res, next) {
  if (!db.isReady()) {
    return res.status(503).json({
      success: false,
      message: 'Este servicio no está disponible en este momento (base de datos sin conexión).'
    });
  }
  next();
}

/** Limitador sencillo en memoria: máximo `max` solicitudes por IP en `windowMs`. */
function rateLimit(max, windowMs, message) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter(t => now - t < windowMs);
    if (list.length >= max) {
      return res.status(429).json({ success: false, message });
    }
    list.push(now);
    hits.set(req.ip, list);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = { clean, optional, fail, handle, requireDb, rateLimit, EMAIL_RE };
