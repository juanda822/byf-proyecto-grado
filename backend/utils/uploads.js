/**
 * Manejo de fotos adjuntas a las PQRS.
 * El navegador envía cada imagen como data URL (base64); aquí se valida
 * el tipo real por su firma binaria y se guarda fuera de la carpeta pública.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// En hosting (Railway) apunta UPLOAD_DIR a un volumen permanente, por ejemplo /data/uploads
const BASE_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const UPLOAD_ROOT = path.join(BASE_ROOT, 'pqrs');
const MAX_BYTES = 6 * 1024 * 1024;       // 6 MB por foto
const MAX_PER_CATEGORY = 6;

const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' }
];

/**
 * Valida una lista de fotos [{ nombre, datos }] y devuelve buffers listos para guardar.
 * Lanza un error con status 400 si algo no es válido.
 */
function parsePhotos(list, categoria, etiqueta) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw badRequest(`Formato inválido en las fotos de ${etiqueta}.`);
  if (list.length > MAX_PER_CATEGORY) {
    throw badRequest(`Puedes adjuntar máximo ${MAX_PER_CATEGORY} fotos de ${etiqueta}.`);
  }
  return list.map((item, index) => {
    const match = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(String(item && item.datos || ''));
    if (!match) throw badRequest(`La foto ${index + 1} de ${etiqueta} no es una imagen válida.`);
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length > MAX_BYTES) {
      throw badRequest(`La foto ${index + 1} de ${etiqueta} supera los 6 MB.`);
    }
    const type = SIGNATURES.find(sig => buffer.length > 12 && sig.test(buffer));
    if (!type) throw badRequest(`La foto ${index + 1} de ${etiqueta} debe ser JPG, PNG o WEBP.`);
    const nombre = String(item.nombre || `foto-${index + 1}.${type.ext}`)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .slice(0, 200);
    return { categoria, buffer, mime: type.mime, ext: type.ext, nombre };
  });
}

/** Escribe las fotos en disco y devuelve los nombres de archivo generados. */
function savePhotos(ticketId, photos) {
  if (!photos.length) return [];
  const dir = path.join(UPLOAD_ROOT, String(ticketId));
  fs.mkdirSync(dir, { recursive: true });
  return photos.map(photo => {
    const archivo = `${photo.categoria}-${crypto.randomBytes(8).toString('hex')}.${photo.ext}`;
    fs.writeFileSync(path.join(dir, archivo), photo.buffer);
    return { ...photo, archivo };
  });
}

function removeTicketFolder(ticketId) {
  fs.rmSync(path.join(UPLOAD_ROOT, String(ticketId)), { recursive: true, force: true });
}

function photoPath(ticketId, archivo) {
  return path.join(UPLOAD_ROOT, String(ticketId), path.basename(archivo));
}

/* ---------------------------------------------------- hojas de vida y noticias */

const DOC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DOC_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', test: b => b.slice(0, 5).toString() === '%PDF-' },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx',
    test: b => b[0] === 0x50 && b[1] === 0x4b && b.includes(Buffer.from('word/')) },
  { mime: 'application/msword', ext: 'doc',
    test: b => b.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) }
];

function decodeDataUrl(value, etiqueta) {
  const match = /^data:[^;,]*;base64,(.+)$/i.exec(String(value || ''));
  if (!match) throw badRequest(`Adjunta ${etiqueta}.`);
  return Buffer.from(match[1], 'base64');
}

function safeName(name, fallback) {
  return String(name || fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200);
}

/** Hoja de vida en PDF o Word (máximo 5 MB), validada por su contenido real. */
function parseDocument(file) {
  const buffer = decodeDataUrl(file && file.datos, 'tu hoja de vida');
  if (buffer.length > DOC_MAX_BYTES) throw badRequest('La hoja de vida supera los 5 MB.');
  const type = DOC_TYPES.find(t => buffer.length > 8 && t.test(buffer));
  if (!type) throw badRequest('La hoja de vida debe estar en PDF o Word (.doc o .docx).');
  return { buffer, mime: type.mime, ext: type.ext, nombre: safeName(file.nombre, `hoja-de-vida.${type.ext}`) };
}

/** Imagen de una noticia (JPG, PNG o WEBP, máximo 6 MB). */
function parseImage(file) {
  const [photo] = parsePhotos([file], 'defecto', 'la noticia');
  return photo;
}

/** Guarda un archivo en una subcarpeta (hojas-vida, noticias) y devuelve su nombre. */
function saveFile(folder, id, ext, buffer) {
  const dir = path.join(BASE_ROOT, folder, String(id));
  fs.mkdirSync(dir, { recursive: true });
  const archivo = `${crypto.randomBytes(10).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, archivo), buffer);
  return archivo;
}

function filePath(folder, id, archivo) {
  return path.join(BASE_ROOT, folder, String(id), path.basename(archivo));
}

function removeFolder(folder, id) {
  fs.rmSync(path.join(BASE_ROOT, folder, String(id)), { recursive: true, force: true });
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

module.exports = {
  parsePhotos, savePhotos, removeTicketFolder, photoPath, MAX_PER_CATEGORY,
  parseDocument, parseImage, saveFile, filePath, removeFolder
};
