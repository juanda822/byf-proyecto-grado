/**
 * Avisos por correo del módulo PQRS.
 * Usa la API HTTP de Brevo (https://www.brevo.com): Railway bloquea el envío por SMTP.
 * Si BREVO_API_KEY o MAIL_FROM no están definidos, los avisos se omiten sin afectar el sitio.
 */

const TIPOS = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo' };
const ESTADOS = { radicado: 'Radicado', en_revision: 'En revisión', respondido: 'Respondido', cerrado: 'Cerrado' };

function enabled() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function siteUrl() {
  return (process.env.SITE_URL || '').replace(/\/+$/, '');
}

/** Plantilla HTML con los colores de B&F (azul oscuro y dorado). */
function layout({ titulo, intro, filas = [], mensaje, boton, pagina = 'pqrs.html', enlace, etiqueta = 'CENTRO PQRS', pie }) {
  const href = enlace || (siteUrl() ? `${siteUrl()}/${pagina}` : '');
  const rows = filas
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:#8193ad;font-size:13px;width:150px;vertical-align:top">${esc(k)}</td>
        <td style="padding:6px 0;color:#0f1e36;font-size:14px">${esc(v)}</td>
      </tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#eef2f8;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:24px 0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#0f1e36;padding:22px 28px;border-bottom:3px solid #d4af37">
        <span style="font-family:Georgia,serif;font-size:22px;color:#ffffff;letter-spacing:1px">B&amp;F</span>
        <span style="color:#d4af37;font-size:13px;letter-spacing:2px;margin-left:10px">${esc(etiqueta)}</span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#0f1e36">${esc(titulo)}</h1>
        <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.5">${esc(intro)}</p>
        ${rows ? `<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:18px">${rows}</table>` : ''}
        ${mensaje ? `<div style="background:#fbf7e9;border-left:4px solid #d4af37;padding:14px 16px;color:#0f1e36;font-size:14px;line-height:1.5;white-space:pre-wrap;margin-bottom:18px">${esc(mensaje)}</div>` : ''}
        ${boton && href ? `<a href="${esc(href)}" style="display:inline-block;background:#d4af37;color:#0f1e36;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-size:14px">${esc(boton)}</a>` : ''}
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 28px;color:#8193ad;font-size:12px">
        ${pie ? esc(pie) : 'Este es un mensaje automático del Centro PQRS de B&amp;F. No respondas a este correo; escríbenos desde tu ticket.'}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function send({ to, toName, subject, html, attachments }) {
  if (!enabled() || !to) return false;
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME || 'B&F Centro PQRS' },
        to: [{ email: to, name: toName || undefined }],
        subject,
        htmlContent: html,
        ...(attachments && attachments.length ? { attachment: attachments } : {})
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      console.error(`[Correo] Brevo respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Correo] No se pudo enviar:', error.message);
    return false;
  }
}

/** Envía sin bloquear la respuesta al usuario. */
function fire(promise) {
  promise.catch(error => console.error('[Correo]', error.message));
}

function filasTicket(t) {
  return [
    ['Ticket', t.codigo],
    ['Cliente', t.cliente],
    ['Número de pedido', t.numero_pedido],
    ['Tipo', TIPOS[t.tipo] || t.tipo],
    ['Asunto', t.asunto],
    ['Prenda', t.prenda],
    ['Talla', t.talla]
  ];
}

/* ------------------------------------------------------------ eventos */

function ticketRadicado(ticket, cliente) {
  if (!enabled()) return;
  fire(send({
    to: cliente.email,
    toName: cliente.nombre,
    subject: `Recibimos tu solicitud ${ticket.codigo}`,
    html: layout({
      titulo: `Tu ticket es ${ticket.codigo}`,
      intro: 'Recibimos tu solicitud. Nuestro equipo la revisará y te responderemos por este medio y en el Centro PQRS.',
      filas: filasTicket(ticket),
      boton: 'Ver mi solicitud'
    })
  }));
  const admin = process.env.ADMIN_NOTIFY_EMAIL;
  if (admin) {
    fire(send({
      to: admin,
      subject: `${ticket.categoria === 'garantia' ? 'Nueva solicitud de garantía' : `Nueva PQRS · ${TIPOS[ticket.tipo]}`} ${ticket.codigo} · ${ticket.cliente}`,
      html: layout({
        titulo: 'Nueva solicitud radicada',
        intro: `${cliente.nombre} (${cliente.email}) radicó una nueva solicitud.`,
        filas: filasTicket(ticket),
        mensaje: ticket.descripcion,
        boton: 'Abrir el panel'
      })
    }));
  }
}

function respuestaAdmin(ticket, cliente, mensaje, estado) {
  if (!enabled()) return;
  fire(send({
    to: cliente.email,
    toName: cliente.nombre,
    subject: `Respuesta a tu solicitud ${ticket.codigo}`,
    html: layout({
      titulo: 'Tienes una respuesta de B&F',
      intro: `Respondimos tu solicitud ${ticket.codigo}. Estado actual: ${ESTADOS[estado] || estado}.`,
      filas: filasTicket(ticket),
      mensaje,
      boton: 'Ver la respuesta'
    })
  }));
}

function mensajeCliente(ticket, cliente, mensaje) {
  const admin = process.env.ADMIN_NOTIFY_EMAIL;
  if (!enabled() || !admin) return;
  fire(send({
    to: admin,
    subject: `Nuevo mensaje del cliente en ${ticket.codigo}`,
    html: layout({
      titulo: 'El cliente escribió en su ticket',
      intro: `${cliente.nombre} (${cliente.email}) agregó un mensaje.`,
      filas: filasTicket(ticket),
      mensaje,
      boton: 'Abrir el panel'
    })
  }));
}

function cambioEstado(ticket, cliente, estado) {
  if (!enabled()) return;
  fire(send({
    to: cliente.email,
    toName: cliente.nombre,
    subject: `Tu solicitud ${ticket.codigo} está: ${ESTADOS[estado] || estado}`,
    html: layout({
      titulo: `Estado: ${ESTADOS[estado] || estado}`,
      intro: estado === 'cerrado'
        ? `Cerramos tu solicitud ${ticket.codigo}. Gracias por confiar en B&F.`
        : `Actualizamos el estado de tu solicitud ${ticket.codigo}.`,
      filas: filasTicket(ticket),
      boton: 'Ver mi solicitud'
    })
  }));
}

const EXPERIENCIA = { sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año', entre_1_3: 'Entre 1 y 3 años', mas_3: 'Más de 3 años' };

/** Nueva hoja de vida: aviso a la empresa (con el archivo adjunto) y confirmación al aspirante. */
function hojaVidaRecibida(hv, archivo) {
  if (!enabled()) return;
  const filas = [
    ['Código', hv.codigo],
    ['Nombre', hv.nombre],
    ['Cargo', hv.cargo_nombre],
    ['Experiencia', EXPERIENCIA[hv.experiencia]],
    ['Correo', hv.email],
    ['Teléfono', hv.telefono]
  ];
  const admin = process.env.ADMIN_NOTIFY_EMAIL;
  if (admin) {
    const pequeño = archivo && archivo.buffer.length <= 4 * 1024 * 1024;
    fire(send({
      to: admin,
      subject: `Nueva hoja de vida ${hv.codigo} · ${hv.cargo_nombre} · ${hv.nombre}`,
      html: layout({
        titulo: 'Nueva hoja de vida recibida',
        intro: pequeño
          ? `${hv.nombre} se postuló para ${hv.cargo_nombre}. La hoja de vida va adjunta a este correo y también está en el panel del administrador.`
          : `${hv.nombre} se postuló para ${hv.cargo_nombre}. Descarga la hoja de vida desde el panel del administrador.`,
        filas,
        mensaje: hv.descripcion,
        boton: 'Abrir el panel',
        etiqueta: 'TRABAJA CON NOSOTROS',
        pie: 'Aviso automático del sitio web de B&F. Trata estos datos personales según la Ley 1581 de 2012.'
      }),
      attachments: pequeño ? [{ name: archivo.nombre, content: archivo.buffer.toString('base64') }] : undefined
    }));
  }
  fire(send({
    to: hv.email,
    toName: hv.nombre,
    subject: `Recibimos tu hoja de vida · ${hv.cargo_nombre}`,
    html: layout({
      titulo: `Gracias, ${hv.nombre.split(' ')[0]}`,
      intro: `Recibimos tu hoja de vida para el cargo de ${hv.cargo_nombre}. Si tu perfil se ajusta a una vacante, nuestro equipo se comunicará contigo.`,
      filas: [['Código', hv.codigo], ['Cargo', hv.cargo_nombre]],
      etiqueta: 'TRABAJA CON NOSOTROS',
      pie: 'Mensaje automático del sitio web de B&F. Puedes pedir la eliminación de tus datos escribiendo a la empresa.'
    })
  }));
}

/**
 * Enlace para restablecer la contraseña. Espera el envío (no usa fire)
 * para poder avisar si el correo no salió.
 */
function recuperarClave(usuario, enlace, minutos) {
  return send({
    to: usuario.email,
    toName: usuario.nombre,
    subject: 'Restablece tu contraseña de B&F',
    html: layout({
      titulo: 'Restablece tu contraseña',
      intro: `Hola, ${usuario.nombre}. Recibimos una solicitud para cambiar la contraseña de tu cuenta en B&F. Usa el botón para crear una nueva. El enlace vence en ${minutos} minutos y sirve una sola vez.`,
      boton: 'Crear nueva contraseña',
      enlace,
      etiqueta: 'MI CUENTA',
      pie: 'Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.'
    })
  });
}

module.exports = { enabled, recuperarClave, ticketRadicado, respuestaAdmin, mensajeCliente, cambioEstado, hojaVidaRecibida };
