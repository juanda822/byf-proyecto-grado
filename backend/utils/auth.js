/**
 * Autenticación del módulo PQRS sin dependencias externas:
 * - Contraseñas con scrypt (módulo crypto de Node).
 * - Tokens firmados con HMAC-SHA256 (formato tipo JWT).
 */
const crypto = require('crypto');

const TOKEN_HOURS = Number(process.env.AUTH_TOKEN_HOURS) || 8;

let secret = process.env.AUTH_SECRET;
if (!secret || secret.length < 32) {
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  AUTH_SECRET no está definido en backend/.env (mínimo 32 caracteres).');
  console.warn('   Se generó uno temporal: las sesiones se cerrarán al reiniciar el servidor.');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const b64url = input => Buffer.from(input).toString('base64url');

function sign(payloadPart) {
  return crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
}

function createToken(user) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: user.id,
    rol: user.rol,
    exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600
  }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Middleware: exige sesión. Con `rol` exige además ese rol ('admin' o 'cliente'). */
function requireAuth(rol) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Tu sesión expiró. Ingresa de nuevo.' });
    }
    if (rol && payload.rol !== rol) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción.' });
    }
    req.user = { id: payload.sub, rol: payload.rol };
    next();
  };
}

/** Limitador sencillo de intentos de inicio de sesión (en memoria). */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function loginBlocked(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailedLogin(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { first: Date.now(), count: 1 });
  } else {
    entry.count++;
  }
}

function clearLoginAttempts(key) {
  attempts.delete(key);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  requireAuth,
  loginBlocked,
  registerFailedLogin,
  clearLoginAttempts
};
