/**
 * Módulo PQRS de B&F: cuentas, tickets de garantía, fotos y respuestas.
 */
const db = require('../config/db');
const auth = require('../utils/auth');
const uploads = require('../utils/uploads');
const mailer = require('../utils/mailer');

const TIPOS = ['peticion', 'queja', 'reclamo'];
const CATEGORIAS = ['pqrs', 'garantia'];
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

async function cuentaDe(usuarioId) {
  const rows = await db.query('SELECT id, nombre, email FROM usuarios WHERE id = ?', [usuarioId]);
  return rows[0] || null;
}

/** Aviso por correo sin afectar la respuesta si algo falla. */
async function avisar(fn) {
  if (!mailer.enabled()) return;
  try {
    await fn();
  } catch (error) {
    console.error('[Correo]', error.message);
  }
}

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
  const categoria = body.categoria === 'garantia' ? 'garantia' : 'pqrs';
  const garantia = categoria === 'garantia';
  const cliente = clean(body.cliente, 150);
  const numeroPedido = optional(body.numeroPedido, 40);
  const tipo = garantia ? 'reclamo' : clean(body.tipo, 20).toLowerCase();
  const asunto = clean(body.asunto, 150) || (garantia ? 'Garantía' : '');
  const descripcion = clean(body.descripcion, 5000);
  const prenda = optional(body.prenda, 100);
  const talla = optional(body.talla, 30);

  if (cliente.length < 2) throw fail(400, 'Escribe el nombre del cliente.');
  if (garantia && !numeroPedido) throw fail(400, 'Escribe el número de pedido de la prenda.');
  if (!TIPOS.includes(tipo)) throw fail(400, 'Selecciona si es una petición, queja o reclamo.');
  if (asunto.length < 3) throw fail(400, 'Indica el asunto de tu solicitud.');
  if (garantia && !prenda) throw fail(400, 'Indica la prenda que presenta el defecto.');
  if (descripcion.length < 10) throw fail(400, 'Describe el motivo con un poco más de detalle.');

  const fotos = [
    ...(garantia ? uploads.parsePhotos(body.fotosPrelavado, 'prelavado', 'prelavado') : []),
    ...uploads.parsePhotos(body.fotosDefecto, 'defecto', garantia ? 'la parte defectuosa' : 'soporte')
  ];
  if (garantia && !fotos.some(f => f.categoria === 'defecto')) {
    throw fail(400, 'Adjunta al menos una foto de la parte defectuosa de la prenda.');
  }

  let ticketId = null;
  try {
    const ticket = await db.transaction(async tx => {
      const result = await tx.query(
        `INSERT INTO tickets (usuario_id, categoria, cliente, numero_pedido, tipo, asunto, prenda, talla, descripcion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, categoria, cliente, numeroPedido, tipo, asunto, prenda, talla, descripcion]
      );
      ticketId = result.insertId;
      const codigo = `${garantia ? 'GAR' : 'PQR'}-${new Date().getFullYear()}-${String(ticketId).padStart(5, '0')}`;
      await tx.query('UPDATE tickets SET codigo = ? WHERE id = ?', [codigo, ticketId]);

      for (const foto of uploads.savePhotos(ticketId, fotos)) {
        await tx.query(
          'INSERT INTO ticket_adjuntos (ticket_id, categoria, nombre_original, archivo, mime, tamano) VALUES (?, ?, ?, ?, ?, ?)',
          [ticketId, foto.categoria, foto.nombre, foto.archivo, foto.mime, foto.buffer.length]
        );
      }
      return { id: ticketId, codigo, categoria };
    });
    res.status(201).json({ success: true, message: 'Solicitud radicada.', data: ticket });
    avisar(async () => {
      const [creado] = await db.query('SELECT * FROM tickets WHERE id = ?', [ticket.id]);
      mailer.ticketRadicado(creado, await cuentaDe(req.user.id));
    });
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
  if (CATEGORIAS.includes(req.query.categoria)) {
    where.push('t.categoria = ?');
    params.push(req.query.categoria);
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
    `SELECT t.id, t.codigo, t.categoria, t.cliente, t.numero_pedido, t.tipo, t.asunto, t.prenda, t.talla, t.estado,
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
  avisar(async () => {
    const cliente = await cuentaDe(ticket.usuario_id);
    if (req.user.rol === 'admin') mailer.respuestaAdmin(ticket, cliente, mensaje, nuevoEstado);
    else mailer.mensajeCliente(ticket, cliente, mensaje);
  });
});

const cambiarEstado = handle(async (req, res) => {
  const ticket = await loadTicketFor(req, req.params.id);
  if (!ESTADOS.includes(req.body.estado)) throw fail(400, 'Estado no válido.');
  await db.query('UPDATE tickets SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?', [req.body.estado, ticket.id]);
  res.json({ success: true, data: { estado: req.body.estado } });
  if (req.body.estado !== ticket.estado) {
    avisar(async () => mailer.cambioEstado(ticket, await cuentaDe(ticket.usuario_id), req.body.estado));
  }
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
  const cat = CATEGORIAS.includes(req.query.categoria) ? req.query.categoria : null;
  const rows = await db.query(
    `SELECT estado, COUNT(*) AS total FROM tickets ${cat ? 'WHERE categoria = ?' : ''} GROUP BY estado`,
    cat ? [cat] : []
  );
  const data = { total: 0 };
  for (const e of ESTADOS) data[e] = 0;
  for (const row of rows) {
    data[row.estado] = Number(row.total);
    data.total += Number(row.total);
  }
  res.json({ success: true, data });
});

/* ---------------------------------------------------------------- reporte */

// Zona horaria para mostrar fechas en reportes y Excel (el servidor del hosting usa UTC)
const TIME_ZONE = process.env.APP_TIMEZONE || 'America/Bogota';

/**
 * Convierte el filtro de fecha en un instante exacto.
 * El navegador envía el inicio/fin del día en hora local como ISO (2026-11-01T05:00:00.000Z).
 * Se pasa a MySQL como Date para que mysql2 lo convierta a la misma zona en que guarda los datos.
 */
function filtroFecha(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(value)) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return isNaN(d) ? null : d;
}

/** Tickets de un rango de fechas (ambos extremos incluidos). */
async function ticketsDelRango(query) {
  const where = [];
  const params = [];
  const desde = filtroFecha(query.desde);
  const hasta = filtroFecha(query.hasta);
  if (desde) {
    where.push('t.creado_en >= ?');
    params.push(desde);
  }
  if (hasta) {
    where.push('t.creado_en <= ?');
    params.push(hasta);
  }
  if (CATEGORIAS.includes(query.categoria)) {
    where.push('t.categoria = ?');
    params.push(query.categoria);
  }
  return db.query(
    `SELECT t.*, u.email AS email_cuenta, u.telefono AS telefono_cuenta,
            (SELECT MIN(r.creado_en) FROM ticket_respuestas r
              WHERE r.ticket_id = t.id AND r.autor_rol = 'admin') AS primera_respuesta,
            (SELECT COUNT(*) FROM ticket_adjuntos a WHERE a.ticket_id = t.id) AS total_fotos
       FROM tickets t JOIN usuarios u ON u.id = t.usuario_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY t.creado_en, t.id`,
    params
  );
}

/** Partes de una fecha en la zona horaria de la empresa: { y, m, d, h, min } */
function partesLocales(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, min: parts.minute };
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function contar(lista, clave, orden) {
  const mapa = new Map();
  for (const item of lista) {
    const k = clave(item);
    if (k) mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  const salida = [...mapa].map(([etiqueta, total]) => ({ etiqueta, total }));
  return orden ? salida.sort(orden) : salida.sort((a, b) => b.total - a.total);
}

const reporte = handle(async (req, res) => {
  const tickets = await ticketsDelRango(req.query);
  const horas = [];
  for (const t of tickets) {
    const inicio = toDate(t.creado_en);
    const resp = toDate(t.primera_respuesta);
    if (inicio && resp) horas.push((resp - inicio) / 3600000);
  }
  const mes = t => {
    const d = toDate(t.creado_en);
    if (!d) return null;
    const p = partesLocales(d);
    return `${p.y}-${p.m}`;
  };
  const normal = v => (v ? String(v).trim().toLowerCase().replace(/^\p{Ll}/u, c => c.toUpperCase()) : null);

  res.json({
    success: true,
    data: {
      total: tickets.length,
      porEstado: ESTADOS.map(e => ({ etiqueta: e, total: tickets.filter(t => t.estado === e).length })),
      porTipo: TIPOS.map(e => ({ etiqueta: e, total: tickets.filter(t => t.tipo === e).length })),
      porMes: contar(tickets, mes, (a, b) => a.etiqueta.localeCompare(b.etiqueta)),
      porAsunto: contar(tickets, t => normal(t.asunto)).slice(0, 8),
      porPrenda: contar(tickets, t => normal(t.prenda)).slice(0, 8),
      porCliente: contar(tickets, t => t.cliente).slice(0, 8),
      respondidos: horas.length,
      sinResponder: tickets.filter(t => !t.primera_respuesta && t.estado !== 'cerrado').length,
      horasPromedioRespuesta: horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null
    }
  });
});

/** Descarga en CSV compatible con Excel (separador ; y BOM para tildes). */
const exportar = handle(async (req, res) => {
  const tickets = await ticketsDelRango(req.query);
  const NOMBRES_TIPO = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo' };
  const NOMBRES_ESTADO = { radicado: 'Radicado', en_revision: 'En revisión', respondido: 'Respondido', cerrado: 'Cerrado' };
  const fecha = v => {
    const d = toDate(v);
    if (!d) return '';
    const p = partesLocales(d);
    return `${p.y}-${p.m}-${p.d} ${p.h}:${p.min}`;
  };
  const celda = v => {
    let txt = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(txt)) txt = "'" + txt; // evita fórmulas al abrir en Excel
    return /[;"\n\r]/.test(txt) ? `"${txt.replace(/"/g, '""')}"` : txt;
  };
  const columnas = [
    ['Ticket', t => t.codigo], ['Categoría', t => (t.categoria === 'garantia' ? 'Garantía' : 'PQRS')], ['Fecha radicado', t => fecha(t.creado_en)], ['Estado', t => NOMBRES_ESTADO[t.estado]],
    ['Tipo', t => NOMBRES_TIPO[t.tipo]], ['Cliente', t => t.cliente], ['Correo', t => t.email_cuenta],
    ['Teléfono', t => t.telefono_contacto || t.telefono_cuenta], ['Número de pedido', t => t.numero_pedido],
    ['Asunto', t => t.asunto], ['Prenda', t => t.prenda], ['Talla', t => t.talla], ['Descripción', t => t.descripcion],
    ['Fotos', t => t.total_fotos], ['Dirección', t => t.direccion], ['Ciudad', t => t.ciudad],
    ['Especificaciones de recogida', t => t.especificaciones_recogida], ['Especificaciones de entrega', t => t.especificaciones_entrega],
    ['Primera respuesta', t => fecha(t.primera_respuesta)], ['Última actualización', t => fecha(t.actualizado_en)]
  ];
  const lineas = [columnas.map(c => c[0]).join(';')];
  for (const t of tickets) lineas.push(columnas.map(c => celda(c[1](t))).join(';'));
  const nombre = `pqrs-byf-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send('﻿' + lineas.join('\r\n'));
});

/* ------------------------------------------------- perfil y panel inicial */

const actualizarPerfil = handle(async (req, res) => {
  const nombre = clean(req.body.nombre, 150);
  if (nombre.length < 3) throw fail(400, 'Escribe tu nombre o el de tu empresa.');
  await db.query('UPDATE usuarios SET nombre = ?, documento = ?, telefono = ? WHERE id = ?',
    [nombre, optional(req.body.documento, 40), optional(req.body.telefono, 40), req.user.id]);
  const [u] = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
  res.json({ success: true, message: 'Datos actualizados.', data: publicUser(u) });
});

const cambiarClave = handle(async (req, res) => {
  const [u] = await db.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
  if (!u || !auth.verifyPassword(String(req.body.actual || ''), u.password_hash)) {
    throw fail(400, 'La contraseña actual no es correcta.');
  }
  validatePassword(req.body.nueva);
  await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [auth.hashPassword(req.body.nueva), u.id]);
  res.json({ success: true, message: 'Contraseña actualizada.' });
});

/** Contadores para los botones del panel del administrador. */
const panelAdmin = handle(async (req, res) => {
  const [t] = await db.query(
    `SELECT SUM(categoria = 'pqrs' AND estado = 'radicado') AS pqrs,
            SUM(categoria = 'garantia' AND estado = 'radicado') AS garantias
       FROM tickets`
  );
  const [h] = await db.query("SELECT COUNT(*) AS n FROM hojas_vida WHERE estado = 'nueva'");
  const [c] = await db.query('SELECT SUM(activo = 1) AS activos, COUNT(*) AS total FROM cargos');
  res.json({
    success: true,
    data: {
      pqrsNuevas: Number(t.pqrs) || 0,
      garantiasNuevas: Number(t.garantias) || 0,
      hojasNuevas: Number(h.n) || 0,
      cargosActivos: Number(c.activos) || 0,
      cargosTotal: Number(c.total) || 0
    }
  });
});

/** Contadores para los botones del panel del cliente. */
const panelCliente = handle(async (req, res) => {
  const [t] = await db.query(
    "SELECT COUNT(*) AS total, SUM(estado = 'respondido') AS respondidas FROM tickets WHERE usuario_id = ?",
    [req.user.id]
  );
  res.json({ success: true, data: { total: Number(t.total) || 0, respondidas: Number(t.respondidas) || 0 } });
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
  responder, cambiarEstado, verAdjunto, resumen, reporte, exportar, requireDb,
  actualizarPerfil, cambiarClave, panelAdmin, panelCliente
};
