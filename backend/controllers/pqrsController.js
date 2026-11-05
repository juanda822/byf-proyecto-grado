/**
 * Módulo PQRS de B&F: cuentas, tickets de garantía, fotos y respuestas.
 */
const db = require('../config/db');
const auth = require('../utils/auth');
const uploads = require('../utils/uploads');

const TIPOS = ['peticion', 'queja', 'reclamo'];
const ESTADOS = ['radicado', 'en_revision', 'respondido', 'cerrado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------------------------------------------------------------- helpers */

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

/** Envuelve un controlador async y traduce errores a respuestas JSON. */
const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese correo.' });
    }
    const status = error.status || 500;
    if (status >= 500) console.error('[PQRS]', error);
    res.status(status).json({
      success: false,
      message: status >= 500 && status !== 503 ? 'Ocurrió un error en el servidor.' : error.message
    });
  }
};

function publicUser(u) {
  return { id: u.id, rol: u.rol, nombre: u.nombre, documento: u.documento, email: u.email, telefono: u.telefono };
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw fail(400, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (password.length > 128) throw fail(400, 'La contraseña es demasiado larga.');
}

async function loadTicketFor(req, id) {
  const rows = await db.query('SELECT * FROM tickets WHERE id = ?', [Number(id) || 0]);
  const ticket = rows[0];
  if (!ticket) throw fail(404, 'No encontramos esa solicitud.');
  if (req.user.rol !== 'admin' && ticket.usuario_id !== req.user.id) {
    throw fail(404, 'No encontramos esa solicitud.');
  }
  return ticket;
}

/* ----------------------------------------------------------------- estado */

const estado = handle(async (req, res) => {
  if (!db.isReady()) {
    return res.json({ success: true, data: { baseDeDatos: false, adminConfigurado: false } });
  }
  const rows = await db.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin'");
  res.json({
    success: true,
    data: {
      baseDeDatos: true,
      adminConfigurado: Number(rows[0].total) > 0,
      requiereClaveConfiguracion: Boolean(process.env.ADMIN_SETUP_KEY)
    }
  });
});

/* ----------------------------------------------------------------- cuentas */

const registro = handle(async (req, res) => {
  const nombre = clean(req.body.nombre, 150);
  const email = clean(req.body.email, 190).toLowerCase();
  const documento = optional(req.body.documento, 40);
  const telefono = optional(req.body.telefono, 40);
  if (nombre.length < 3) throw fail(400, 'Escribe el nombre del cliente o de la empresa.');
  if (!EMAIL_RE.test(email)) throw fail(400, 'Escribe un correo electrónico válido.');
  validatePassword(req.body.password);

  const result = await db.query(
    "INSERT INTO usuarios (rol, nombre, documento, email, telefono, password_hash) VALUES ('cliente', ?, ?, ?, ?, ?)",
    [nombre, documento, email, telefono, auth.hashPassword(req.body.password)]
  );
  const user = { id: result.insertId, rol: 'cliente', nombre, documento, email, telefono };
  res.status(201).json({ success: true, message: 'Cuenta creada.', data: { token: auth.createToken(user), usuario: user } });
});

const login = handle(async (req, res) => {
  const email = clean(req.body.email, 190).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const key = `${req.ip}|${email}`;
  if (auth.loginBlocked(key)) {
    throw fail(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  }
  const rows = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    auth.registerFailedLogin(key);
    throw fail(401, 'Correo o contraseña incorrectos.');
  }
  auth.clearLoginAttempts(key);
  res.json({ success: true, data: { token: auth.createToken(user), usuario: publicUser(user) } });
});

const yo = handle(async (req, res) => {
  const rows = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
  if (!rows[0]) throw fail(401, 'Tu sesión expiró. Ingresa de nuevo.');
  res.json({ success: true, data: publicUser(rows[0]) });
});

/** Crea la cuenta del administrador. Solo funciona mientras no exista ninguno. */
const configurarAdmin = handle(async (req, res) => {
  if (process.env.ADMIN_SETUP_KEY && req.body.clave !== process.env.ADMIN_SETUP_KEY) {
    throw fail(403, 'La clave de configuración no es correcta.');
  }
  const existing = await db.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin'");
  if (Number(existing[0].total) > 0) {
    throw fail(409, 'La cuenta de administrador ya fue creada. Ingresa con ella.');
  }
  const nombre = clean(req.body.nombre, 150);
  const email = clean(req.body.email, 190).toLowerCase();
  if (nombre.length < 3) throw fail(400, 'Escribe el nombre del administrador.');
  if (!EMAIL_RE.test(email)) throw fail(400, 'Escribe un correo electrónico válido.');
  validatePassword(req.body.password);

  const result = await db.query(
    "INSERT INTO usuarios (rol, nombre, email, password_hash) VALUES ('admin', ?, ?, ?)",
    [nombre, email, auth.hashPassword(req.body.password)]
  );
  const user = { id: result.insertId, rol: 'admin', nombre, documento: null, email, telefono: null };
  res.status(201).json({ success: true, message: 'Administrador creado.', data: { token: auth.createToken(user), usuario: user } });
});

/* ----------------------------------------------------------------- tickets */

const crearTicket = handle(async (req, res) => {
  const body = req.body || {};
  const cliente = clean(body.cliente, 150);
  const numeroPedido = clean(body.numeroPedido, 40);
  const tipo = clean(body.tipo, 20).toLowerCase();
  const asunto = clean(body.asunto, 150);
  const descripcion = clean(body.descripcion, 5000);
  const prenda = optional(body.prenda, 100);
  const talla = optional(body.talla, 30);

  if (cliente.length < 2) throw fail(400, 'Escribe el nombre del cliente.');
  if (!numeroPedido) throw fail(400, 'Escribe el número de pedido.');
  if (!TIPOS.includes(tipo)) throw fail(400, 'Selecciona si es una petición, queja o reclamo.');
  if (asunto.length < 3) throw fail(400, 'Indica el asunto de tu solicitud (por ejemplo: Garantía).');
  if (descripcion.length < 10) throw fail(400, 'Describe el motivo con un poco más de detalle.');

  const fotos = [
    ...uploads.parsePhotos(body.fotosPrelavado, 'prelavado', 'prelavado'),
    ...uploads.parsePhotos(body.fotosDefecto, 'defecto', 'la parte defectuosa')
  ];

  let ticketId = null;
  try {
    const ticket = await db.transaction(async tx => {
      const result = await tx.query(
        `INSERT INTO tickets (usuario_id, cliente, numero_pedido, tipo, asunto, prenda, talla, descripcion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, cliente, numeroPedido, tipo, asunto, prenda, talla, descripcion]
      );
      ticketId = result.insertId;
      const codigo = `PQR-${new Date().getFullYear()}-${String(ticketId).padStart(5, '0')}`;
      await tx.query('UPDATE tickets SET codigo = ? WHERE id = ?', [codigo, ticketId]);

      for (const foto of uploads.savePhotos(ticketId, fotos)) {
        await tx.query(
          'INSERT INTO ticket_adjuntos (ticket_id, categoria, nombre_original, archivo, mime, tamano) VALUES (?, ?, ?, ?, ?, ?)',
          [ticketId, foto.categoria, foto.nombre, foto.archivo, foto.mime, foto.buffer.length]
        );
      }
      return { id: ticketId, codigo };
    });
    res.status(201).json({ success: true, message: 'Solicitud radicada.', data: ticket });
  } catch (error) {
    if (ticketId) uploads.removeTicketFolder(ticketId);
    throw error;
  }
});

const listarTickets = handle(async (req, res) => {
  const where = [];
  const params = [];
  if (req.user.rol !== 'admin') {
    where.push('t.usuario_id = ?');
    params.push(req.user.id);
  }
  if (ESTADOS.includes(req.query.estado)) {
    where.push('t.estado = ?');
    params.push(req.query.estado);
  }
  if (TIPOS.includes(req.query.tipo)) {
    where.push('t.tipo = ?');
    params.push(req.query.tipo);
  }
  const q = clean(req.query.q, 100);
  if (q) {
    where.push('(t.codigo LIKE ? OR t.cliente LIKE ? OR t.numero_pedido LIKE ? OR t.asunto LIKE ?)');
    const like = `%${q.replace(/[%_\\]/g, m => '\\' + m)}%`;
    params.push(like, like, like, like);
  }
  const rows = await db.query(
    `SELECT t.id, t.codigo, t.cliente, t.numero_pedido, t.tipo, t.asunto, t.prenda, t.talla, t.estado,
            t.creado_en, t.actualizado_en, u.email AS email_cuenta,
            (SELECT COUNT(*) FROM ticket_respuestas r WHERE r.ticket_id = t.id) AS total_respuestas
       FROM tickets t
       JOIN usuarios u ON u.id = t.usuario_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY t.creado_en DESC, t.id DESC
      LIMIT 500`,
    params
  );
  res.json({ success: true, count: rows.length, data: rows });
});

const verTicket = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  const [cuenta] = await db.query('SELECT nombre, email, telefono, documento FROM usuarios WHERE id = ?', [ticket.usuario_id]);
  const adjuntos = await db.query(
    'SELECT id, categoria, nombre_original, mime, tamano, creado_en FROM ticket_adjuntos WHERE ticket_id = ? ORDER BY id',
    [ticket.id]
  );
  const respuestas = await db.query(
    `SELECT r.id, r.autor_rol, r.mensaje, r.creado_en, u.nombre AS autor
       FROM ticket_respuestas r JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.ticket_id = ? ORDER BY r.creado_en, r.id`,
    [ticket.id]
  );
  res.json({ success: true, data: { ...ticket, cuenta: cuenta || null, adjuntos, respuestas } });
});

/** Paso 2: datos de dirección, recogida y entrega. */
const actualizarLogistica = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  if (req.user.rol !== 'admin' && ticket.usuario_id !== req.user.id) throw fail(403, 'No tienes permiso.');
  if (ticket.estado === 'cerrado') throw fail(409, 'Esta solicitud ya está cerrada.');
  const body = req.body || {};
  await db.query(
    `UPDATE tickets SET direccion = ?, ciudad = ?, telefono_contacto = ?,
            especificaciones_recogida = ?, especificaciones_entrega = ?
      WHERE id = ?`,
    [
      optional(body.direccion, 255),
      optional(body.ciudad, 100),
      optional(body.telefonoContacto, 40),
      optional(body.especificacionesRecogida, 2000),
      optional(body.especificacionesEntrega, 2000),
      ticket.id
    ]
  );
  res.json({ success: true, message: 'Datos guardados.' });
});

const responder = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  const mensaje = clean(req.body.mensaje, 5000);
  if (mensaje.length < 2) throw fail(400, 'Escribe un mensaje.');
  if (ticket.estado === 'cerrado' && req.user.rol !== 'admin') {
    throw fail(409, 'Esta solicitud ya está cerrada.');
  }

  let nuevoEstado;
  if (req.user.rol === 'admin') {
    nuevoEstado = ESTADOS.includes(req.body.estado) ? req.body.estado : 'respondido';
  } else {
    nuevoEstado = ticket.estado === 'respondido' ? 'en_revision' : ticket.estado;
  }

  await db.transaction(async tx => {
    await tx.query(
      'INSERT INTO ticket_respuestas (ticket_id, usuario_id, autor_rol, mensaje) VALUES (?, ?, ?, ?)',
      [ticket.id, req.user.id, req.user.rol, mensaje]
    );
    await tx.query('UPDATE tickets SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?', [nuevoEstado, ticket.id]);
  });
  res.status(201).json({ success: true, message: 'Mensaje enviado.', data: { estado: nuevoEstado } });
});

const cambiarEstado = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  if (!ESTADOS.includes(req.body.estado)) throw fail(400, 'Estado no válido.');
  await db.query('UPDATE tickets SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?', [req.body.estado, ticket.id]);
  res.json({ success: true, data: { estado: req.body.estado } });
});

const verAdjunto = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  const rows = await db.query('SELECT * FROM ticket_adjuntos WHERE id = ? AND ticket_id = ?', [Number(req.params.adjuntoId) || 0, ticket.id]);
  if (!rows[0]) throw fail(404, 'Foto no encontrada.');
  res.setHeader('Content-Type', rows[0].mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(uploads.photoPath(ticket.id, rows[0].archivo), err => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'Foto no encontrada.' });
  });
});

const resumen = handle(async (req, res) => {
  const rows = await db.query('SELECT estado, COUNT(*) AS total FROM tickets GROUP BY estado');
  const data = { total: 0 };
  for (const e of ESTADOS) data[e] = 0;
  for (const row of rows) {
    data[row.estado] = Number(row.total);
    data.total += Number(row.total);
  }
  res.json({ success: true, data });
});

/** Responde 503 si MySQL no está conectado. */
function requireDb(req, res, next) {
  if (!db.isReady()) {
    return res.status(503).json({
      success: false,
      message: 'El sistema de PQRS no está disponible en este momento (base de datos sin conexión).'
    });
  }
  next();
}

module.exports = {
  estado, registro, login, yo, configurarAdmin,
  crearTicket, listarTickets, verTicket, actualizarLogistica,
  responder, cambiarEstado, verAdjunto, resumen, requireDb
};
