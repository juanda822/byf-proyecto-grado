/**
 * Trabaja con nosotros: cargos disponibles y hojas de vida recibidas.
 */
const db = require('../config/db');
const uploads = require('../utils/uploads');
const mailer = require('../utils/mailer');
const { clean, optional, fail, handle, EMAIL_RE } = require('../utils/http');

const EXPERIENCIAS = ['sin_experiencia', 'menos_1', 'entre_1_3', 'mas_3'];
const ESTADOS = ['nueva', 'revisada', 'preseleccionada', 'descartada'];
const FOLDER = 'hojas-vida';

/* ------------------------------------------------------------ público */

/** Cargos activos para el formulario. */
const cargosActivos = handle(async (req, res) => {
  const rows = await db.query('SELECT id, nombre, area FROM cargos WHERE activo = 1 ORDER BY orden, nombre');
  res.json({ success: true, data: rows });
});

/** Recibe una postulación con su hoja de vida. */
const postular = handle(async (req, res) => {
  const body = req.body || {};
  // Campo trampa: los robots lo llenan, las personas no lo ven
  if (clean(body.sitio, 200)) return res.status(201).json({ success: true, data: { codigo: 'HV-0' } });

  const nombre = clean(body.nombre, 150);
  const email = clean(body.email, 190).toLowerCase();
  const telefono = clean(body.telefono, 40);
  const experiencia = clean(body.experiencia, 20);
  const descripcion = optional(body.descripcion, 3000);
  const cargoId = Number(body.cargoId) || 0;

  if (nombre.length < 3) throw fail(400, 'Escribe tu nombre completo.');
  if (!EMAIL_RE.test(email)) throw fail(400, 'Escribe un correo electrónico válido.');
  if (!/^[\d\s+()-]{7,40}$/.test(telefono)) throw fail(400, 'Escribe un teléfono de contacto válido.');
  if (!EXPERIENCIAS.includes(experiencia)) throw fail(400, 'Indica tu experiencia en el área.');
  if (body.autorizaDatos !== true) {
    throw fail(400, 'Debes autorizar el tratamiento de tus datos personales para enviar la postulación.');
  }
  const [cargo] = await db.query('SELECT id, nombre FROM cargos WHERE id = ? AND activo = 1', [cargoId]);
  if (!cargo) throw fail(400, 'Selecciona un cargo disponible.');

  const archivo = uploads.parseDocument(body.hojaVida);

  let id = null;
  try {
    const hv = await db.transaction(async tx => {
      const result = await tx.query(
        `INSERT INTO hojas_vida (nombre, email, telefono, cargo_id, cargo_nombre, experiencia, descripcion,
                                 archivo, nombre_original, mime, tamano, autoriza_datos)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, NOW())`,
        [nombre, email, telefono, cargo.id, cargo.nombre, experiencia, descripcion,
         archivo.nombre, archivo.mime, archivo.buffer.length]
      );
      id = result.insertId;
      const codigo = `HV-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
      const guardado = uploads.saveFile(FOLDER, id, archivo.ext, archivo.buffer);
      await tx.query('UPDATE hojas_vida SET codigo = ?, archivo = ? WHERE id = ?', [codigo, guardado, id]);
      return { id, codigo, nombre, email, telefono, cargo_nombre: cargo.nombre, experiencia, descripcion };
    });
    res.status(201).json({ success: true, message: 'Postulación recibida.', data: { codigo: hv.codigo } });
    mailer.hojaVidaRecibida(hv, archivo);
  } catch (error) {
    if (id) uploads.removeFolder(FOLDER, id);
    throw error;
  }
});

/* ------------------------------------------------------- administrador */

const listar = handle(async (req, res) => {
  const where = [];
  const params = [];
  if (ESTADOS.includes(req.query.estado)) {
    where.push('estado = ?');
    params.push(req.query.estado);
  }
  if (Number(req.query.cargo)) {
    where.push('cargo_id = ?');
    params.push(Number(req.query.cargo));
  }
  const q = clean(req.query.q, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, m => '\\' + m)}%`;
    where.push('(codigo LIKE ? OR nombre LIKE ? OR email LIKE ? OR cargo_nombre LIKE ?)');
    params.push(like, like, like, like);
  }
  const rows = await db.query(
    `SELECT id, codigo, nombre, email, telefono, cargo_id, cargo_nombre, experiencia, estado, creado_en
       FROM hojas_vida ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY creado_en DESC, id DESC LIMIT 500`,
    params
  );
  res.json({ success: true, count: rows.length, data: rows });
});

async function cargar(id) {
  const [hv] = await db.query('SELECT * FROM hojas_vida WHERE id = ?', [Number(id) || 0]);
  if (!hv) throw fail(404, 'No encontramos esa hoja de vida.');
  return hv;
}

const ver = handle(async (req, res) => {
  const hv = await cargar(req.params.id);
  delete hv.archivo;
  res.json({ success: true, data: hv });
});

const actualizar = handle(async (req, res) => {
  const hv = await cargar(req.params.id);
  const estado = req.body.estado === undefined ? hv.estado : req.body.estado;
  if (!ESTADOS.includes(estado)) throw fail(400, 'Estado no válido.');
  const notas = req.body.notas === undefined ? hv.notas : optional(req.body.notas, 3000);
  await db.query('UPDATE hojas_vida SET estado = ?, notas = ? WHERE id = ?', [estado, notas, hv.id]);
  res.json({ success: true, data: { estado } });
});

/** Elimina la postulación y su archivo (derecho de supresión, Ley 1581 de 2012). */
const eliminar = handle(async (req, res) => {
  const hv = await cargar(req.params.id);
  await db.query('DELETE FROM hojas_vida WHERE id = ?', [hv.id]);
  uploads.removeFolder(FOLDER, hv.id);
  res.json({ success: true, message: 'Hoja de vida eliminada.' });
});

const descargar = handle(async (req, res) => {
  const hv = await cargar(req.params.id);
  if (hv.estado === 'nueva') await db.query("UPDATE hojas_vida SET estado = 'revisada' WHERE id = ?", [hv.id]);
  res.setHeader('Content-Type', hv.mime);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(hv.nombre_original)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(uploads.filePath(FOLDER, hv.id, hv.archivo), err => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
  });
});

/* ------------------------------------------------------------- cargos */

const cargosTodos = handle(async (req, res) => {
  const rows = await db.query(
    `SELECT c.id, c.nombre, c.area, c.activo, c.orden,
            (SELECT COUNT(*) FROM hojas_vida h WHERE h.cargo_id = c.id) AS total,
            (SELECT COUNT(*) FROM hojas_vida h WHERE h.cargo_id = c.id AND h.estado = 'nueva') AS nuevas
       FROM cargos c ORDER BY c.orden, c.nombre`
  );
  res.json({ success: true, data: rows });
});

const crearCargo = handle(async (req, res) => {
  const nombre = clean(req.body.nombre, 120);
  const area = clean(req.body.area, 80) || 'Producción';
  if (nombre.length < 3) throw fail(400, 'Escribe el nombre del cargo.');
  const [max] = await db.query('SELECT COALESCE(MAX(orden), 0) AS m FROM cargos');
  const result = await db.query('INSERT INTO cargos (nombre, area, orden) VALUES (?, ?, ?)', [nombre, area, Number(max.m) + 1]);
  res.status(201).json({ success: true, data: { id: result.insertId } });
});

const actualizarCargo = handle(async (req, res) => {
  const [cargo] = await db.query('SELECT * FROM cargos WHERE id = ?', [Number(req.params.id) || 0]);
  if (!cargo) throw fail(404, 'Cargo no encontrado.');
  const nombre = req.body.nombre === undefined ? cargo.nombre : clean(req.body.nombre, 120);
  const area = req.body.area === undefined ? cargo.area : clean(req.body.area, 80);
  const activo = req.body.activo === undefined ? cargo.activo : (req.body.activo ? 1 : 0);
  if (nombre.length < 3) throw fail(400, 'Escribe el nombre del cargo.');
  await db.query('UPDATE cargos SET nombre = ?, area = ?, activo = ? WHERE id = ?', [nombre, area, activo, cargo.id]);
  res.json({ success: true });
});

/** Activa o desactiva todos los cargos de una vez. */
const todosCargos = handle(async (req, res) => {
  await db.query('UPDATE cargos SET activo = ?', [req.body.activo ? 1 : 0]);
  res.json({ success: true });
});

module.exports = {
  cargosActivos, postular,
  listar, ver, actualizar, eliminar, descargar,
  cargosTodos, crearCargo, actualizarCargo, todosCargos
};
