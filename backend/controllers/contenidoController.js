/**
 * Contenido editable del sitio: textos de "Trabaja con nosotros" y noticias de la página principal.
 */
const db = require('../config/db');
const uploads = require('../utils/uploads');
const { clean, fail, handle } = require('../utils/http');

const CLAVES = { trabaja_titulo: 80, trabaja_texto: 400, trabaja_intro: 400 };
const FOLDER = 'noticias';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------- textos */

const textos = handle(async (req, res) => {
  const rows = await db.query('SELECT clave, valor FROM contenido');
  res.json({ success: true, data: Object.fromEntries(rows.map(r => [r.clave, r.valor])) });
});

const guardarTextos = handle(async (req, res) => {
  const body = req.body || {};
  for (const [clave, max] of Object.entries(CLAVES)) {
    if (body[clave] === undefined) continue;
    const valor = clean(body[clave], max);
    if (!valor) throw fail(400, 'Ningún texto puede quedar vacío.');
    await db.query(
      'INSERT INTO contenido (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [clave, valor]
    );
  }
  res.json({ success: true, message: 'Textos guardados.' });
});

/* ------------------------------------------------------------ noticias */

function imagenUrl(n) {
  if (!n.imagen) return null;
  if (n.imagen.startsWith('assets/')) return n.imagen;
  return `/api/contenido/noticias/${n.id}/imagen?v=${new Date(n.actualizado_en).getTime() || 0}`;
}

function publica(n) {
  const fecha = n.fecha instanceof Date ? n.fecha.toISOString().slice(0, 10) : String(n.fecha).slice(0, 10);
  return { id: n.id, titulo: n.titulo, resumen: n.resumen, fecha, visible: Boolean(n.visible), imagen: imagenUrl(n) };
}

const noticiasPublicas = handle(async (req, res) => {
  const rows = await db.query('SELECT * FROM noticias WHERE visible = 1 ORDER BY fecha DESC, id DESC LIMIT 12');
  res.json({ success: true, data: rows.map(publica) });
});

const noticiasTodas = handle(async (req, res) => {
  const rows = await db.query('SELECT * FROM noticias ORDER BY fecha DESC, id DESC');
  res.json({ success: true, data: rows.map(publica) });
});

function datosNoticia(body) {
  const titulo = clean(body.titulo, 160);
  const resumen = clean(body.resumen, 2000);
  const fecha = clean(body.fecha, 10);
  if (titulo.length < 3) throw fail(400, 'Escribe el título de la noticia.');
  if (resumen.length < 10) throw fail(400, 'Escribe el texto de la noticia.');
  if (!DATE_RE.test(fecha)) throw fail(400, 'Indica la fecha de la noticia.');
  return { titulo, resumen, fecha, visible: body.visible === false ? 0 : 1 };
}

async function guardarImagen(id, imagen) {
  if (!imagen) return;
  const foto = uploads.parseImage(imagen);
  uploads.removeFolder(FOLDER, id);
  const archivo = uploads.saveFile(FOLDER, id, foto.ext, foto.buffer);
  await db.query('UPDATE noticias SET imagen = ?, imagen_mime = ? WHERE id = ?', [archivo, foto.mime, id]);
}

const crearNoticia = handle(async (req, res) => {
  const n = datosNoticia(req.body || {});
  if (!req.body.imagen) throw fail(400, 'Agrega una imagen para la noticia.');
  uploads.parseImage(req.body.imagen); // valida antes de crear
  const result = await db.query('INSERT INTO noticias (titulo, resumen, fecha, visible) VALUES (?, ?, ?, ?)',
    [n.titulo, n.resumen, n.fecha, n.visible]);
  await guardarImagen(result.insertId, req.body.imagen);
  res.status(201).json({ success: true, data: { id: result.insertId } });
});

async function cargar(id) {
  const [n] = await db.query('SELECT * FROM noticias WHERE id = ?', [Number(id) || 0]);
  if (!n) throw fail(404, 'Noticia no encontrada.');
  return n;
}

const actualizarNoticia = handle(async (req, res) => {
  const actual = await cargar(req.params.id);
  const body = req.body || {};
  if (Object.keys(body).length === 1 && body.visible !== undefined) {
    await db.query('UPDATE noticias SET visible = ? WHERE id = ?', [body.visible ? 1 : 0, actual.id]);
    return res.json({ success: true });
  }
  const n = datosNoticia(body);
  await db.query('UPDATE noticias SET titulo = ?, resumen = ?, fecha = ?, visible = ? WHERE id = ?',
    [n.titulo, n.resumen, n.fecha, n.visible, actual.id]);
  await guardarImagen(actual.id, body.imagen);
  res.json({ success: true });
});

const eliminarNoticia = handle(async (req, res) => {
  const n = await cargar(req.params.id);
  await db.query('DELETE FROM noticias WHERE id = ?', [n.id]);
  uploads.removeFolder(FOLDER, n.id);
  res.json({ success: true });
});

const imagenNoticia = handle(async (req, res) => {
  const n = await cargar(req.params.id);
  if (!n.imagen || n.imagen.startsWith('assets/') || (!n.visible && !req.query.admin)) throw fail(404, 'Imagen no encontrada.');
  res.setHeader('Content-Type', n.imagen_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(uploads.filePath(FOLDER, n.id, n.imagen), err => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'Imagen no encontrada.' });
  });
});

module.exports = {
  textos, guardarTextos,
  noticiasPublicas, noticiasTodas, crearNoticia, actualizarNoticia, eliminarNoticia, imagenNoticia
};
