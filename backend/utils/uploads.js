/**
 * Manejo de fotos adjuntas a las PQRS.
 * El navegador envía cada imagen como data URL (base64); aquí se valida
 * el tipo real por su firma binaria y se guarda fuera de la carpeta pública.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'pqrs');
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

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

module.exports = { parsePhotos, savePhotos, removeTicketFolder, photoPath, MAX_PER_CATEGORY };
