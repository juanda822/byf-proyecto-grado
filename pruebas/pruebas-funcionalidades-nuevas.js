/*
 * Casos de prueba CP-29 a CP-42: funcionalidades agregadas después de la primera ronda de pruebas
 * (Trabaja con nosotros, cargos, textos y noticias, recuperación de contraseña y datos obligatorios del cliente).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { api: apiH, bitacora, correos, run } = require('./banco-pruebas');
let A, C;
const api = (m, u, o = {}) => apiH(m, u, { ...o, rol: o.token ? (o.token === A ? 'administrador' : 'cliente') : 'sin sesión' });

const FRONT = path.resolve(__dirname, '..', 'frontend');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;
const png = fs.readFileSync(path.join(FRONT, 'assets', 'noticiasbyf', 'capacitacion.png'));

const resultados = [];
async function caso(id, nombre, fn) {
  bitacora.length = 0;
  correos.length = 0;
  try {
    const obtenido = await fn();
    resultados.push({ id, nombre, obtenido, estado: 'Aprobado', bitacora: [...bitacora], correos: correos.map(c => ({ to: c.to, subject: c.subject, adjuntos: c.adjuntos })) });
    console.log(`✔ ${id} ${nombre}\n    ${obtenido}`);
  } catch (e) {
    resultados.push({ id, nombre, obtenido: e.message, estado: 'Fallido' });
    console.log(`✘ ${id} ${nombre}\n    ${e.stack}`);
  }
}

const postulacion = (extra = {}) => ({
  nombre: 'Laura Gómez', email: 'laura@correo.test', telefono: '300 123 4567', cargoId: 2,
  experiencia: 'entre_1_3', descripcion: 'Confección industrial', autorizaDatos: true,
  hojaVida: { nombre: 'HV Laura.pdf', datos: dataUrl(pdf, 'application/pdf') }, ...extra
});

(async () => {
  // Cuentas de prueba: administrador y cliente
  const adm = await api('POST', '/api/pqrs/admin/configurar', { body: { nombre: 'Admin ByF', email: 'admin@byf.test', password: 'Clave-Admin-1' } });
  const cli = await api('POST', '/api/pqrs/auth/registro', { body: { nombre: 'Textiles Andinos', documento: '900.123.456-7', telefono: '601 745 6060', email: 'cliente@correo.test', password: 'Clave-Cliente-1' } });
  assert.equal(adm.status, 201); assert.equal(cli.status, 201);
  A = adm.body.data.token; C = cli.body.data.token;

  /* ------------------------------------------------ Trabaja con nosotros */
  await caso('CP-29', 'Enviar hoja de vida válida', async () => {
    correos.length = 0;
    const r = await api('POST', '/api/empleo/postulaciones', { body: postulacion() });
    assert.equal(r.status, 201);
    assert.match(r.body.data.codigo, /^HV-\d{4}-00001$/);
    await new Promise(s => setTimeout(s, 50));
    const aviso = correos.find(c => c.to.includes('admin@byf.test'));
    assert.ok(aviso && aviso.adjuntos === 1, 'aviso al administrador con la hoja de vida adjunta');
    return `Postulación registrada con código 201 y código ${r.body.data.codigo}; aviso por correo al administrador con el PDF adjunto`;
  });

  await caso('CP-30', 'Postulación sin autorizar el tratamiento de datos', async () => {
    const r = await api('POST', '/api/empleo/postulaciones', { body: postulacion({ autorizaDatos: false }), ip: '10.0.0.2' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /autorizar el tratamiento/);
    return 'Rechazo con código 400: debe autorizar el tratamiento de sus datos personales';
  });

  await caso('CP-31', 'Archivo falso como hoja de vida', async () => {
    const falso = { nombre: 'hoja.pdf', datos: dataUrl(Buffer.from('esto no es un PDF, es texto plano'), 'application/pdf') };
    const r = await api('POST', '/api/empleo/postulaciones', { body: postulacion({ hojaVida: falso }), ip: '10.0.0.3' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /PDF o Word/);
    return 'Rechazo con código 400: la hoja de vida debe estar en PDF o Word';
  });

  await caso('CP-32', 'Postulación a un cargo desactivado', async () => {
    run('UPDATE cargos SET activo = 0 WHERE id = 3');
    const r = await api('POST', '/api/empleo/postulaciones', { body: postulacion({ cargoId: 3 }), ip: '10.0.0.4' });
    run('UPDATE cargos SET activo = 1 WHERE id = 3');
    assert.equal(r.status, 400);
    assert.match(r.body.message, /cargo disponible/);
    return 'Rechazo con código 400: debe seleccionar un cargo disponible';
  });

  await caso('CP-33', 'Cliente o visitante consulta las hojas de vida', async () => {
    const sin = await api('GET', '/api/empleo/admin/hojas-vida');
    const cliente = await api('GET', '/api/empleo/admin/hojas-vida', { token: C });
    const archivo = await api('GET', '/api/empleo/admin/hojas-vida/1/archivo', { token: C });
    assert.equal(sin.status, 401); assert.equal(cliente.status, 403); assert.equal(archivo.status, 403);
    return 'Sin sesión: código 401; con sesión de cliente: código 403 en el listado y en la descarga';
  });

  await caso('CP-34', 'Administrador revisa y descarga una hoja de vida', async () => {
    const lista = await api('GET', '/api/empleo/admin/hojas-vida?q=Laura', { token: A });
    assert.equal(lista.status, 200); assert.equal(lista.body.count, 1);
    const d = await api('GET', `/api/empleo/admin/hojas-vida/${lista.body.data[0].id}/archivo`, { token: A });
    assert.equal(d.status, 200);
    assert.ok(Buffer.compare(d.body, pdf) === 0, 'archivo idéntico');
    assert.match(d.headers['content-disposition'], /HV%20Laura\.pdf/);
    const [hv] = run('SELECT estado FROM hojas_vida WHERE id = ?', [lista.body.data[0].id]);
    assert.equal(hv.estado, 'revisada');
    const est = await api('PATCH', `/api/empleo/admin/hojas-vida/${lista.body.data[0].id}`, { token: A, body: { estado: 'preseleccionada' } });
    assert.equal(est.status, 200);
    return 'Búsqueda encontró 1 postulación; el PDF se descargó idéntico al enviado, quedó como Revisada y luego como Preseleccionada';
  });

  await caso('CP-35', 'Administrador crea y desactiva un cargo', async () => {
    const c = await api('POST', '/api/empleo/admin/cargos', { token: A, body: { nombre: 'Patronista', area: 'Diseño' } });
    assert.equal(c.status, 201);
    let pub = await api('GET', '/api/empleo/cargos');
    assert.ok(pub.body.data.some(x => x.nombre === 'Patronista'));
    const off = await api('PATCH', `/api/empleo/admin/cargos/${c.body.data.id}`, { token: A, body: { activo: false } });
    assert.equal(off.status, 200);
    pub = await api('GET', '/api/empleo/cargos');
    assert.ok(!pub.body.data.some(x => x.nombre === 'Patronista'));
    const dup = await api('POST', '/api/empleo/admin/cargos', { token: A, body: { nombre: 'Patronista' } });
    assert.equal(dup.status, 409);
    return 'Cargo creado (201) y visible en el formulario; al desactivarlo dejó de aparecer; nombre repetido rechazado con 409';
  });

  /* ------------------------------------------------ textos y noticias */
  await caso('CP-36', 'Administrador edita los textos de Trabaja con nosotros', async () => {
    const ok = await api('PUT', '/api/contenido/admin/textos', { token: A, body: { trabaja_titulo: 'Únete a ByF', trabaja_intro: 'Envíanos tu hoja de vida.' } });
    assert.equal(ok.status, 200);
    const pub = await api('GET', '/api/contenido/textos');
    assert.equal(pub.body.data.trabaja_titulo, 'Únete a ByF');
    const vacio = await api('PUT', '/api/contenido/admin/textos', { token: A, body: { trabaja_titulo: '   ' } });
    assert.equal(vacio.status, 400);
    const cliente = await api('PUT', '/api/contenido/admin/textos', { token: C, body: { trabaja_titulo: 'Hackeado' } });
    assert.equal(cliente.status, 403);
    return 'Textos guardados y visibles en la página pública; texto vacío rechazado con 400; cliente rechazado con 403';
  });

  await caso('CP-37', 'Publicar, ocultar y eliminar una noticia', async () => {
    const n = await api('POST', '/api/contenido/admin/noticias', { token: A, body: { titulo: 'Nueva línea reflectiva', resumen: 'Presentamos la nueva línea de prendas reflectivas.', fecha: '2026-11-09', imagen: { nombre: 'foto.png', datos: dataUrl(png, 'image/png') } } });
    assert.equal(n.status, 201);
    let pub = await api('GET', '/api/contenido/noticias');
    const visible = pub.body.data.find(x => x.id === n.body.data.id);
    assert.ok(visible && visible.imagen.startsWith('/api/contenido/noticias/'));
    const img = await api('GET', visible.imagen);
    assert.equal(img.status, 200); assert.equal(img.headers['content-type'], 'image/png');
    await api('PATCH', `/api/contenido/admin/noticias/${n.body.data.id}`, { token: A, body: { visible: false } });
    pub = await api('GET', '/api/contenido/noticias');
    assert.ok(!pub.body.data.some(x => x.id === n.body.data.id));
    const del = await api('DELETE', `/api/contenido/admin/noticias/${n.body.data.id}`, { token: A });
    assert.equal(del.status, 200);
    return 'Noticia publicada (201) con su imagen en la página principal; al ocultarla dejó de mostrarse y se eliminó con código 200';
  });

  await caso('CP-38', 'Noticia sin imagen o creada por un cliente', async () => {
    const sin = await api('POST', '/api/contenido/admin/noticias', { token: A, body: { titulo: 'Sin foto', resumen: 'Noticia de prueba sin imagen.', fecha: '2026-11-09' } });
    assert.equal(sin.status, 400);
    const cli = await api('POST', '/api/contenido/admin/noticias', { token: C, body: { titulo: 'X', resumen: 'Y', fecha: '2026-11-09' } });
    assert.equal(cli.status, 403);
    return 'Sin imagen: rechazo con código 400; con sesión de cliente: rechazo con código 403';
  });

  /* ------------------------------------------------ recuperación de contraseña */
  let enlace;
  await caso('CP-39', 'Solicitar enlace de recuperación de contraseña', async () => {
    correos.length = 0;
    const r = await api('POST', '/api/pqrs/auth/olvide', { body: { email: 'CLIENTE@correo.test' }, ip: '10.0.1.1' });
    assert.equal(r.status, 200);
    await new Promise(s => setTimeout(s, 50));
    assert.equal(correos.length, 1); assert.deepEqual(correos[0].to, ['cliente@correo.test']);
    enlace = /pqrs\.html#restablecer=([0-9a-f]{64})/.exec(correos[0].html)[1];
    const otro = await api('POST', '/api/pqrs/auth/olvide', { body: { email: 'nadie@correo.test' }, ip: '10.0.1.2' });
    await new Promise(s => setTimeout(s, 50));
    assert.equal(otro.status, 200); assert.equal(otro.body.message, r.body.message); assert.equal(correos.length, 1);
    return 'Llegó un correo con el enlace a la cuenta registrada; con un correo no registrado la respuesta fue idéntica y no se envió nada';
  });

  await caso('CP-40', 'Crear una contraseña nueva con el enlace', async () => {
    const r = await api('POST', '/api/pqrs/auth/restablecer', { body: { token: enlace, password: 'Nueva-Clave-2' } });
    assert.equal(r.status, 200); assert.ok(r.body.data.token);
    const vieja = await api('POST', '/api/pqrs/auth/login', { body: { email: 'cliente@correo.test', password: 'Clave-Cliente-1' }, ip: '10.0.1.3' });
    const nueva = await api('POST', '/api/pqrs/auth/login', { body: { email: 'cliente@correo.test', password: 'Nueva-Clave-2' }, ip: '10.0.1.3' });
    assert.equal(vieja.status, 401); assert.equal(nueva.status, 200);
    return 'Contraseña cambiada con código 200 y sesión iniciada; la contraseña anterior fue rechazada (401) y la nueva aceptada (200)';
  });

  await caso('CP-41', 'Enlace de recuperación usado o vencido', async () => {
    const usado = await api('POST', '/api/pqrs/auth/restablecer', { body: { token: enlace, password: 'Otra-Clave-3' } });
    assert.equal(usado.status, 400);
    const token = crypto.randomBytes(32).toString('hex');
    run("INSERT INTO recuperaciones_clave (usuario_id, token_hash, expira_en) VALUES (2, ?, datetime('now', '-1 minutes'))",
      [crypto.createHash('sha256').update(token).digest('hex')]);
    const vencido = await api('POST', '/api/pqrs/auth/restablecer', { body: { token, password: 'Otra-Clave-3' } });
    assert.equal(vencido.status, 400); assert.match(vencido.body.message, /venció/);
    return 'Enlace ya usado y enlace vencido: rechazo con código 400 “El enlace ya se usó o venció”';
  });

  /* ------------------------------------------------ datos obligatorios del cliente */
  await caso('CP-42', 'Registro y perfil sin NIT o cédula y teléfono', async () => {
    const reg = await api('POST', '/api/pqrs/auth/registro', { body: { nombre: 'Cliente Sin Datos', email: 'sindatos@correo.test', password: 'Clave-Cliente-9' } });
    assert.equal(reg.status, 400); assert.match(reg.body.message, /NIT o la cédula/);
    const login = await api('POST', '/api/pqrs/auth/login', { body: { email: 'cliente@correo.test', password: 'Nueva-Clave-2' }, ip: '10.0.1.4' });
    const perfil = await api('PATCH', '/api/pqrs/auth/perfil', { token: login.body.data.token, body: { nombre: 'Textiles Andinos', documento: '900123456', telefono: '' } });
    assert.equal(perfil.status, 400); assert.match(perfil.body.message, /teléfono/);
    return 'Registro sin NIT o cédula: rechazo con código 400; perfil con el teléfono vacío: rechazo con código 400';
  });

  if (process.env.SALIDA) fs.writeFileSync(process.env.SALIDA, JSON.stringify(resultados, null, 2));
  const fallidos = resultados.filter(r => r.estado !== 'Aprobado').length;
  console.log(`\n${resultados.length - fallidos} de ${resultados.length} casos aprobados`);
  process.exit(fallidos ? 1 : 0);
})();
