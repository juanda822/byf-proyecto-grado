/* ==========================================================================
   PQRS.JS - Centro de Peticiones, Quejas, Reclamos y Garantías B&F
   ========================================================================== */
(() => {
  'use strict';

  const API = '/api/pqrs';
  const TOKEN_KEY = 'byf_pqrs_token';
  const MAX_FOTOS = 6;

  const TIPOS = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo' };
  const ESTADOS = { radicado: 'Radicado', en_revision: 'En revisión', respondido: 'Respondido', cerrado: 'Cerrado' };

  const USER_KEY = 'byf_pqrs_user'; // nombre y rol para el encabezado de las demás páginas

  const storage = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: v => {
      try {
        if (v) localStorage.setItem(TOKEN_KEY, v);
        else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
      } catch { /* */ }
    },
    setUser: u => { try { localStorage.setItem(USER_KEY, JSON.stringify({ nombre: u.nombre, rol: u.rol })); } catch { /* */ } }
  };

  const state = {
    token: storage.get(),
    user: null,
    status: null,
    lastTicket: null,
    fotos: { prelavado: [], defecto: [], soporte: [] },
    categoria: 'pqrs',
    objectUrls: [],
    resetToken: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------------------ utilidades */

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') : value);
    return isNaN(d) ? null : d;
  }

  function fecha(value, withTime = false) {
    const d = parseDate(value);
    if (!d) return '—';
    return d.toLocaleString('es-CO', withTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function badge(estado) {
    return `<span class="pq-badge pq-badge-${esc(estado)}">${esc(ESTADOS[estado] || estado)}</span>`;
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = $('#pqToast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    let response;
    try {
      const url = path.startsWith('@') ? '/api' + path.slice(1) : API + path;
      response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
    }
    let data = {};
    try { data = await response.json(); } catch { /* respuesta sin JSON */ }
    if (response.status === 401 && state.token && !path.startsWith('/auth/login')) {
      logout(false);
      toast(data.message || 'Tu sesión expiró. Ingresa de nuevo.', true);
    }
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Error ${response.status}`);
    }
    return data;
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setError(form, message) {
    const el = $('[data-error]', form);
    if (el) el.textContent = message || '';
  }

  function setOk(form, message) {
    const el = $('[data-ok]', form);
    if (el) el.textContent = message || '';
  }

  async function withBusy(button, work) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="pq-spinner"></span> Procesando…';
    try {
      return await work();
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  /** NIT o cédula y teléfono del cliente (mismas reglas que el servidor). */
  function contactoInvalido(form, data) {
    if (!/^[0-9][0-9.\- ]{4,18}[0-9]$/.test(String(data.documento || '').trim())) {
      setError(form, 'Escribe el NIT o la cédula (solo números, puntos o guion).');
      markInvalid(form, ['documento']);
      return true;
    }
    if (!/^\d{7,15}$/.test(String(data.telefono || '').replace(/[\s()+-]/g, ''))) {
      setError(form, 'Escribe un teléfono válido (entre 7 y 15 dígitos).');
      markInvalid(form, ['telefono']);
      return true;
    }
    return false;
  }

  function markInvalid(form, names) {
    $$('.pq-field', form).forEach(f => f.classList.remove('invalid'));
    names.forEach(name => {
      const input = form.elements[name];
      if (input) input.closest('.pq-field')?.classList.add('invalid');
    });
    if (names[0] && form.elements[names[0]]) form.elements[names[0]].focus();
  }

  /* ---------------------------------------------------------------- vistas */

  function showView(id) {
    ['viewAuth', 'viewCliente', 'viewAdmin'].forEach(v => { $('#' + v).hidden = v !== id; });
    $('#pqLoading').hidden = true;
    window.scrollTo({ top: 0 });
  }

  function renderSession() {
    const box = $('#pqSession');
    if (!state.user) { box.hidden = true; return; }
    storage.setUser(state.user);
    box.hidden = false;
    $('#pqSessionRole').textContent = state.user.rol === 'admin' ? 'Administrador' : 'Cliente';
    $('#pqSessionName').textContent = state.user.nombre;
  }

  function enterApp() {
    renderSession();
    if (state.user.rol === 'admin') {
      showView('viewAdmin');
      goAdmin('inicio');
    } else {
      $('#clienteNombre').textContent = state.user.nombre;
      showView('viewCliente');
      goClient('inicio');
    }
  }

  /** Vuelve al panel inicial del rol actual. */
  function goHome() {
    if (state.user?.rol === 'admin') goAdmin('inicio');
    else goClient('inicio');
  }

  function logout(notify = true) {
    state.token = null;
    state.user = null;
    storage.set(null);
    closeDrawer();
    renderSession();
    $('[data-auth-tab="login"]').click();
    showView('viewAuth');
    refreshStatus();
    if (notify) toast('Cerraste sesión.');
  }

  function startSession(data) {
    state.token = data.token;
    state.user = data.usuario;
    storage.set(data.token);
    enterApp();
  }

  /* --------------------------------------------------------------- acceso */

  async function refreshStatus() {
    try {
      const { data } = await api('/estado');
      state.status = data;
      const banner = $('#pqBanner');
      banner.hidden = data.baseDeDatos;
      banner.textContent = data.baseDeDatos ? '' :
        'El sistema de PQRS no está disponible: el servidor no tiene conexión con la base de datos MySQL.';
      $('#adminSetup').hidden = !data.baseDeDatos || data.adminConfigurado;
      $('#adminSetupKeyField').hidden = !data.requiereClaveConfiguracion;
    } catch (error) {
      const banner = $('#pqBanner');
      banner.hidden = false;
      banner.textContent = 'No se pudo contactar el servidor de PQRS. Abre esta página desde el servidor de B&F (npm start).';
    }
  }

  /** Muestra un formulario de acceso: login, registro, olvide o restablecer. */
  function showAuthPanel(name) {
    const tab = name === 'registro' ? 'registro' : 'login';
    $$('[data-auth-tab]').forEach(t => {
      const active = t.dataset.authTab === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    $$('[data-auth-panel]').forEach(p => {
      p.hidden = p.dataset.authPanel !== name;
      setError(p);
      setOk(p);
    });
    // Lleva el correo escrito en Ingresar al formulario de recuperación
    if (name === 'olvide') {
      const email = $('#formLogin').elements.email.value;
      if (email && !$('#formOlvide').elements.email.value) $('#formOlvide').elements.email.value = email;
      $('#formOlvide').elements.email.focus();
    }
  }

  function initAuth() {
    $$('[data-auth-tab]').forEach(tab => tab.addEventListener('click', () => showAuthPanel(tab.dataset.authTab)));
    $$('[data-go-auth]').forEach(link => link.addEventListener('click', () => showAuthPanel(link.dataset.goAuth)));

    $('#formLogin').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = formData(form);
      setError(form);
      if (!data.email || !data.password) {
        setError(form, 'Escribe tu correo y contraseña.');
        return markInvalid(form, [!data.email ? 'email' : 'password']);
      }
      try {
        const res = await withBusy($('button[type=submit]', form), () =>
          api('/auth/login', { method: 'POST', body: { email: data.email, password: data.password } }));
        form.reset();
        startSession(res.data);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#formRegistro').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = formData(form);
      setError(form);
      const missing = ['nombre', 'documento', 'telefono', 'email', 'password', 'password2'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(form, 'Completa los campos obligatorios (*).');
        return markInvalid(form, missing);
      }
      if (contactoInvalido(form, data)) return;
      if (data.password.length < 8) {
        setError(form, 'La contraseña debe tener al menos 8 caracteres.');
        return markInvalid(form, ['password']);
      }
      if (data.password !== data.password2) {
        setError(form, 'Las contraseñas no coinciden.');
        return markInvalid(form, ['password2']);
      }
      markInvalid(form, []);
      try {
        const res = await withBusy($('button[type=submit]', form), () =>
          api('/auth/registro', { method: 'POST', body: data }));
        form.reset();
        toast('¡Bienvenido! Tu cuenta fue creada.');
        startSession(res.data);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#formOlvide').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const email = String(formData(form).email || '').trim();
      setError(form);
      setOk(form);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setError(form, 'Escribe un correo electrónico válido.');
        return markInvalid(form, ['email']);
      }
      try {
        const res = await withBusy($('button[type=submit]', form), () =>
          api('/auth/olvide', { method: 'POST', body: { email } }));
        setOk(form, res.message);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#formRestablecer').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = formData(form);
      setError(form);
      if (!state.resetToken) {
        return setError(form, 'Abre de nuevo el enlace que te llegó al correo o pide uno nuevo.');
      }
      if (String(data.password || '').length < 8) {
        setError(form, 'La contraseña debe tener al menos 8 caracteres.');
        return markInvalid(form, ['password']);
      }
      if (data.password !== data.password2) {
        setError(form, 'Las contraseñas no coinciden.');
        return markInvalid(form, ['password2']);
      }
      markInvalid(form, []);
      try {
        const res = await withBusy($('button[type=submit]', form), () =>
          api('/auth/restablecer', { method: 'POST', body: { token: state.resetToken, password: data.password } }));
        state.resetToken = null;
        form.reset();
        toast('Tu contraseña fue actualizada.');
        startSession(res.data);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#adminSetupToggle').addEventListener('click', e => {
      const form = $('#formAdminSetup');
      form.hidden = !form.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!form.hidden));
    });

    $('#formAdminSetup').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = formData(form);
      setError(form);
      const missing = ['nombre', 'email', 'password', 'password2'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(form, 'Completa todos los campos.');
        return markInvalid(form, missing);
      }
      if (data.password !== data.password2) {
        setError(form, 'Las contraseñas no coinciden.');
        return markInvalid(form, ['password2']);
      }
      try {
        const res = await withBusy($('button[type=submit]', form), () =>
          api('/admin/configurar', { method: 'POST', body: data }));
        form.reset();
        toast('Cuenta de administrador creada.');
        startSession(res.data);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#pqLogout').addEventListener('click', () => logout());
  }

  /* ------------------------------------------------------- panel cliente */

  function initClient() {
    $$('[data-client-go]').forEach(btn => btn.addEventListener('click', () => goClient(btn.dataset.clientGo)));
    $$('[data-go-home]').forEach(btn => btn.addEventListener('click', goHome));
    $$('[data-upload]').forEach(initUpload);

    /* --- Crear PQRS --- */
    const fp = $('#formPqrs');
    fp.elements.tipo.addEventListener('change', () => {
      const label = TIPOS[fp.elements.tipo.value];
      $('#asuntoLabel').textContent = label ? `Asunto de tu ${label.toLowerCase()} *` : 'Asunto *';
    });
    fp.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(fp);
      setError(fp);
      const missing = ['cliente', 'tipo', 'asunto', 'descripcion'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(fp, 'Completa los campos obligatorios (*).');
        return markInvalid(fp, missing);
      }
      if (data.descripcion.trim().length < 10) {
        setError(fp, 'Describe tu solicitud con un poco más de detalle.');
        return markInvalid(fp, ['descripcion']);
      }
      markInvalid(fp, []);
      const body = { ...data, categoria: 'pqrs', fotosDefecto: state.fotos.soporte.map(f => ({ nombre: f.nombre, datos: f.datos })) };
      try {
        const res = await withBusy($('button[type=submit]', fp), () => api('/tickets', { method: 'POST', body }));
        state.lastTicket = res.data;
        $('#pqrsCodigo').textContent = res.data.codigo;
        fp.hidden = true;
        $('#pqrsListo').hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        setError(fp, error.message);
      }
    });
    $('#nuevaPqrs').addEventListener('click', resetPqrs);
    $('#verPqrsCreada').addEventListener('click', () => {
      goClient('mis');
      openTicket(state.lastTicket.id);
    });

    /* --- Solicitar garantía (asistente de 3 pasos) --- */
    const form = $('#formTicket');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(form);
      setError(form);
      const missing = ['cliente', 'numeroPedido', 'defecto', 'prenda', 'descripcion'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(form, 'Completa los campos obligatorios (*).');
        return markInvalid(form, missing);
      }
      if (data.descripcion.trim().length < 10) {
        setError(form, 'Describe el defecto con un poco más de detalle.');
        return markInvalid(form, ['descripcion']);
      }
      if (!state.fotos.defecto.length) {
        setError(form, 'Adjunta al menos una foto de la parte defectuosa de la prenda.');
        $('[data-upload="defecto"] .pq-dropzone').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      markInvalid(form, []);
      const body = {
        categoria: 'garantia',
        cliente: data.cliente,
        numeroPedido: data.numeroPedido,
        asunto: `Garantía: ${data.defecto}`,
        prenda: data.prenda,
        talla: data.talla,
        descripcion: data.descripcion,
        fotosPrelavado: state.fotos.prelavado.map(f => ({ nombre: f.nombre, datos: f.datos })),
        fotosDefecto: state.fotos.defecto.map(f => ({ nombre: f.nombre, datos: f.datos }))
      };
      try {
        const res = await withBusy($('button[type=submit]', form), () => api('/tickets', { method: 'POST', body }));
        state.lastTicket = res.data;
        $$('[data-ticket-code]').forEach(el => { el.textContent = res.data.codigo; });
        const logistica = $('#formLogistica');
        logistica.reset();
        logistica.elements.telefonoContacto.value = state.user.telefono || '';
        goStep(2);
      } catch (error) {
        setError(form, error.message);
      }
    });

    $('#formLogistica').addEventListener('submit', async e => {
      e.preventDefault();
      const formL = e.currentTarget;
      setError(formL);
      try {
        await withBusy($('button[type=submit]', formL), () =>
          api(`/tickets/${state.lastTicket.id}/logistica`, { method: 'PATCH', body: formData(formL) }));
        goStep(3);
      } catch (error) {
        setError(formL, error.message);
      }
    });

    $('#skipLogistica').addEventListener('click', () => goStep(3));
    $('#nuevaOtra').addEventListener('click', resetWizard);
    $('#verTicketCreado').addEventListener('click', () => {
      goClient('mis');
      openTicket(state.lastTicket.id);
    });

    /* --- Mi perfil --- */
    const fperfil = $('#formPerfil');
    fperfil.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(fperfil);
      setError(fperfil);
      if (String(data.nombre || '').trim().length < 3) {
        setError(fperfil, 'Escribe tu nombre o el de tu empresa.');
        return markInvalid(fperfil, ['nombre']);
      }
      const faltan = ['documento', 'telefono'].filter(k => !String(data[k] || '').trim());
      if (faltan.length) {
        setError(fperfil, 'Completa los campos obligatorios (*).');
        return markInvalid(fperfil, faltan);
      }
      if (contactoInvalido(fperfil, data)) return;
      try {
        const res = await withBusy($('button[type=submit]', fperfil), () => api('/auth/perfil', { method: 'PATCH', body: data }));
        state.user = res.data;
        renderSession();
        $('#clienteNombre').textContent = state.user.nombre;
        toast('Tus datos quedaron actualizados.');
      } catch (error) {
        setError(fperfil, error.message);
      }
    });
    const fclave = $('#formClave');
    fclave.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(fclave);
      setError(fclave);
      const missing = ['actual', 'nueva', 'nueva2'].filter(k => !data[k]);
      if (missing.length) {
        setError(fclave, 'Completa los tres campos.');
        return markInvalid(fclave, missing);
      }
      if (data.nueva.length < 8) {
        setError(fclave, 'La nueva contraseña debe tener al menos 8 caracteres.');
        return markInvalid(fclave, ['nueva']);
      }
      if (data.nueva !== data.nueva2) {
        setError(fclave, 'Las contraseñas nuevas no coinciden.');
        return markInvalid(fclave, ['nueva2']);
      }
      try {
        await withBusy($('button[type=submit]', fclave), () =>
          api('/auth/clave', { method: 'POST', body: { actual: data.actual, nueva: data.nueva } }));
        fclave.reset();
        toast('Tu contraseña fue actualizada.');
      } catch (error) {
        setError(fclave, error.message);
      }
    });
  }

  function goClient(name) {
    $$('[data-client-panel]').forEach(p => { p.hidden = p.dataset.clientPanel !== name; });
    window.scrollTo({ top: 0 });
    if (name === 'inicio') loadClientPanel();
    if (name === 'mis') loadClientTickets();
    if (name === 'nueva') resetPqrs();
    if (name === 'garantia') resetWizard();
    if (name === 'perfil') fillPerfil();
  }

  async function loadClientPanel() {
    try {
      const { data } = await api('/cliente/panel');
      const badgeEl = $('#badgeMis');
      badgeEl.hidden = !data.respondidas;
      badgeEl.textContent = data.respondidas;
      badgeEl.title = `${data.respondidas} con respuesta de B&F`;
      $('#tileMis').textContent = data.total ? `${data.total} solicitud(es)` : 'Estado y respuestas';
    } catch { /* el panel funciona sin contadores */ }
  }

  function fillPerfil() {
    const f = $('#formPerfil');
    markInvalid(f, []);
    setError(f);
    ['nombre', 'documento', 'telefono', 'email'].forEach(k => { f.elements[k].value = state.user[k] || ''; });
    $('#formClave').reset();
    setError($('#formClave'));
  }

  function resetPqrs() {
    const fp = $('#formPqrs');
    fp.reset();
    fp.hidden = false;
    $('#pqrsListo').hidden = true;
    markInvalid(fp, []);
    setError(fp);
    fp.elements.cliente.value = state.user?.nombre || '';
    fp.elements.tipo.dispatchEvent(new Event('change'));
    state.fotos.soporte = [];
    renderThumbs($('[data-upload="soporte"]'));
  }

  function goStep(step) {
    $$('[data-step]').forEach(el => { el.hidden = Number(el.dataset.step) !== step; });
    $$('[data-step-dot]').forEach(dot => {
      const n = Number(dot.dataset.stepDot);
      dot.classList.toggle('active', n === step);
      dot.classList.toggle('done', n < step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetWizard() {
    const form = $('#formTicket');
    form.reset();
    markInvalid(form, []);
    setError(form);
    form.elements.cliente.value = state.user?.nombre || '';
    state.fotos.prelavado = [];
    state.fotos.defecto = [];
    $$('[data-upload="prelavado"], [data-upload="defecto"]').forEach(renderThumbs);
    state.lastTicket = null;
    goStep(1);
  }

  async function loadClientTickets() {
    const box = $('#clienteTickets');
    try {
      const { data } = await api('/tickets');
      $('#misCount').textContent = data.length;
      if (!data.length) {
        box.innerHTML = `<div class="pq-empty"><i class="fa-solid fa-ticket"></i>
          Aún no has radicado ninguna solicitud.</div>`;
        return;
      }
      box.innerHTML = data.map(t => `
        <button type="button" class="pq-ticket-item" data-open-ticket="${t.id}">
          <span class="pq-ticket-code">${esc(t.codigo)}</span>
          <span class="pq-ticket-main">
            <strong>${t.categoria === 'garantia' ? 'Garantía' : esc(TIPOS[t.tipo])} · ${esc(t.asunto.replace(/^Garantía: /, ''))}</strong>
            <small>${[t.numero_pedido ? 'Pedido ' + esc(t.numero_pedido) : '', esc(t.prenda || ''), esc(t.talla || '')].filter(Boolean).join(' · ') || 'Sin pedido asociado'}</small>
          </span>
          <span class="pq-ticket-side">
            ${badge(t.estado)}
            <small>${fecha(t.creado_en)}${Number(t.total_respuestas) ? ` · ${t.total_respuestas} mensaje(s)` : ''}</small>
          </span>
        </button>`).join('');
    } catch (error) {
      box.innerHTML = `<div class="pq-empty">${esc(error.message)}</div>`;
    }
  }

  /* ---------------------------------------------------------------- fotos */

  function initUpload(box) {
    const categoria = box.dataset.upload;
    const input = $('input[type=file]', box);
    const zone = $('.pq-dropzone', box);

    input.addEventListener('change', () => {
      addFiles(categoria, input.files, box);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));
    zone.addEventListener('drop', e => addFiles(categoria, e.dataTransfer.files, box));

    $('.pq-thumbs', box).addEventListener('click', e => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      state.fotos[categoria].splice(Number(btn.dataset.remove), 1);
      renderThumbs(box);
    });
  }

  async function addFiles(categoria, fileList, box) {
    const files = Array.from(fileList || []).filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (fileList && fileList.length && !files.length) {
      toast('Solo se permiten imágenes JPG, PNG o WEBP.', true);
      return;
    }
    const space = MAX_FOTOS - state.fotos[categoria].length;
    if (files.length > space) toast(`Máximo ${MAX_FOTOS} fotos por sección.`, true);
    for (const file of files.slice(0, Math.max(space, 0))) {
      try {
        const datos = await compressImage(file);
        state.fotos[categoria].push({ nombre: file.name, datos });
        renderThumbs(box);
      } catch {
        toast(`No se pudo leer la imagen ${file.name}.`, true);
      }
    }
  }

  function renderThumbs(box) {
    const list = state.fotos[box.dataset.upload];
    $('.pq-thumbs', box).innerHTML = list.map((f, i) => `
      <div class="pq-thumb">
        <img src="${f.datos}" alt="${esc(f.nombre)}">
        <button type="button" data-remove="${i}" aria-label="Quitar ${esc(f.nombre)}"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');
  }

  /** Reduce la foto a máx. 1600 px y la convierte a JPEG para enviarla más liviana. */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------- panel admin */

  let searchTimer;
  function initAdmin() {
    const filters = $('#adminFilters');
    filters.addEventListener('submit', e => e.preventDefault());
    filters.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadAdminTickets, e.target.name === 'q' ? 300 : 0);
    });
    $$('[data-filter-estado]').forEach(btn => btn.addEventListener('click', () => {
      filters.elements.estado.value = btn.dataset.filterEstado;
      loadAdminTickets();
    }));
    $('#adminRefresh').addEventListener('click', () => {
      if ($('[data-admin-panel="reporte"]').hidden) loadAdmin();
      else loadReport();
    });
    $$('[data-admin-go]').forEach(btn => btn.addEventListener('click', () => goAdmin(btn.dataset.adminGo)));
    initHojas();
    initContenido();
    initReport();
    $('#adminTickets').addEventListener('click', e => {
      const row = e.target.closest('[data-open-ticket]');
      if (row) openTicket(row.dataset.openTicket);
    });
    $('#adminTickets').addEventListener('keydown', e => {
      const row = e.target.closest('[data-open-ticket]');
      if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTicket(row.dataset.openTicket); }
    });
  }

  /* --------------------------------------------------------------- reporte */

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function isoDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function initReport() {
    $$('[data-admin-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-admin-tab]').forEach(t => t.classList.toggle('active', t === tab));
      $$('[data-admin-panel]').forEach(p => { p.hidden = p.dataset.adminPanel !== tab.dataset.adminTab; });
      if (tab.dataset.adminTab === 'reporte') loadReport();
      else loadAdmin();
    }));

    const form = $('#reportFilters');
    form.addEventListener('submit', e => e.preventDefault());
    $$('[data-preset]', form).forEach(btn => btn.addEventListener('click', () => {
      const hoy = new Date();
      let desde = '';
      if (btn.dataset.preset === 'mes') desde = isoDay(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
      if (btn.dataset.preset === '30') desde = isoDay(new Date(hoy.getTime() - 29 * 86400000));
      if (btn.dataset.preset === 'anio') desde = isoDay(new Date(hoy.getFullYear(), 0, 1));
      form.elements.desde.value = desde;
      form.elements.hasta.value = desde ? isoDay(hoy) : '';
      $$('[data-preset]', form).forEach(b => b.classList.toggle('active', b === btn));
      loadReport();
    }));
    ['desde', 'hasta'].forEach(name => form.elements[name].addEventListener('change', () => {
      $$('[data-preset]', form).forEach(b => b.classList.remove('active'));
      loadReport();
    }));

    $('#reportCsv').addEventListener('click', async e => {
      const btn = e.currentTarget;
      try {
        await withBusy(btn, async () => {
          const res = await fetch(`${API}/admin/exportar?${reportParams()}`, { headers: { Authorization: `Bearer ${state.token}` } });
          if (!res.ok) throw new Error('No se pudo generar el archivo.');
          const blob = await res.blob();
          const name = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || 'pqrs-byf.csv';
          const url = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement('a'), { href: url, download: name });
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        });
      } catch (error) {
        toast(error.message, true);
      }
    });

    $('#reportPrint').addEventListener('click', () => {
      document.body.classList.add('pq-printing');
      window.print();
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('pq-printing'));
  }

  /** Envía inicio y fin del día en la hora local del navegador (Colombia), como instante exacto. */
  function reportParams() {
    const form = $('#reportFilters');
    const params = new URLSearchParams();
    params.set('categoria', state.categoria);
    const { desde, hasta } = { desde: form.elements.desde.value, hasta: form.elements.hasta.value };
    if (desde) params.set('desde', new Date(`${desde}T00:00:00`).toISOString());
    if (hasta) params.set('hasta', new Date(`${hasta}T23:59:59.999`).toISOString());
    return params;
  }

  function periodoTexto() {
    const form = $('#reportFilters');
    const f = v => new Date(v + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    const { desde, hasta } = { desde: form.elements.desde.value, hasta: form.elements.hasta.value };
    if (desde && hasta) return `Del ${f(desde)} al ${f(hasta)}`;
    if (desde) return `Desde el ${f(desde)}`;
    if (hasta) return `Hasta el ${f(hasta)}`;
    return 'Todas las solicitudes registradas';
  }

  function duracion(horas) {
    if (horas === null || horas === undefined) return '—';
    if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
    if (horas < 48) return `${horas.toFixed(1).replace('.', ',')} h`;
    return `${(horas / 24).toFixed(1).replace('.', ',')} días`;
  }

  function bars(list, labels = {}) {
    const max = Math.max(1, ...list.map(i => i.total));
    if (!list.length || list.every(i => !i.total)) return '<p class="pq-muted">Sin datos en este periodo.</p>';
    return `<div class="pq-bars">${list.map(i => `
      <div class="pq-bar-row">
        <span title="${esc(labels[i.etiqueta] || i.etiqueta)}">${esc(labels[i.etiqueta] || i.etiqueta)}</span>
        <div class="pq-bar-track"><div class="pq-bar-fill" style="width:${(i.total / max) * 100}%"></div></div>
        <span>${i.total}</span>
      </div>`).join('')}</div>`;
  }

  function columns(list) {
    if (!list.length) return '<p class="pq-muted">Sin datos en este periodo.</p>';
    const max = Math.max(1, ...list.map(i => i.total));
    return `<div class="pq-columns">${list.slice(-12).map(i => {
      const [y, m] = i.etiqueta.split('-');
      return `<div class="pq-col">
        <b>${i.total}</b>
        <div class="pq-col-bar" style="height:${(i.total / max) * 100}%"></div>
        <span>${MESES[Number(m) - 1]} ${y.slice(2)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  async function loadReport() {
    $('#reportPeriodo').textContent = periodoTexto();
    const kpis = $('#reportKpis');
    const charts = $('#reportCharts');
    try {
      const { data } = await api('/admin/reporte?' + reportParams());
      const pct = data.total ? Math.round((data.respondidos / data.total) * 100) : 0;
      kpis.innerHTML = `
        <div class="pq-kpi"><div class="pq-kpi-num">${data.total}</div><div class="pq-kpi-label">Solicitudes</div><small>en el periodo</small></div>
        <div class="pq-kpi"><div class="pq-kpi-num">${data.respondidos}</div><div class="pq-kpi-label">Respondidas</div><small>${pct}% del total</small></div>
        <div class="pq-kpi"><div class="pq-kpi-num">${data.sinResponder}</div><div class="pq-kpi-label">Pendientes de respuesta</div><small>abiertas sin respuesta</small></div>
        <div class="pq-kpi"><div class="pq-kpi-num">${duracion(data.horasPromedioRespuesta)}</div><div class="pq-kpi-label">Tiempo promedio</div><small>hasta la primera respuesta</small></div>`;
      charts.innerHTML = `
        <section class="pq-card pq-chart"><h3>Por estado</h3>${bars(data.porEstado, ESTADOS)}</section>
        <section class="pq-card pq-chart"><h3>Por tipo</h3>${bars(data.porTipo, TIPOS)}</section>
        <section class="pq-card pq-chart"><h3>Solicitudes por mes</h3>${columns(data.porMes)}</section>
        <section class="pq-card pq-chart"><h3>Motivos más frecuentes</h3>${bars(data.porAsunto)}</section>
        <section class="pq-card pq-chart"><h3>Prendas con más casos</h3>${bars(data.porPrenda)}</section>
        <section class="pq-card pq-chart"><h3>Clientes con más solicitudes</h3>${bars(data.porCliente)}</section>`;
    } catch (error) {
      kpis.innerHTML = '';
      charts.innerHTML = `<p class="pq-muted">${esc(error.message)}</p>`;
    }
  }

  function loadAdmin() {
    loadAdminStats();
    loadAdminTickets();
  }

  async function loadAdminStats() {
    try {
      const { data } = await api('/admin/resumen?categoria=' + state.categoria);
      $$('[data-stat]').forEach(el => { el.textContent = data[el.dataset.stat] ?? 0; });
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function loadAdminTickets() {
    const filters = $('#adminFilters');
    const params = new URLSearchParams({ categoria: state.categoria });
    ['q', 'estado', 'tipo'].forEach(k => { if (filters.elements[k].value) params.set(k, filters.elements[k].value.trim()); });
    $$('[data-filter-estado]').forEach(b => b.classList.toggle('active', b.dataset.filterEstado === filters.elements.estado.value));
    const body = $('#adminTickets');
    try {
      const { data } = await api('/tickets?' + params);
      if (!data.length) {
        body.innerHTML = '<tr><td class="pq-empty-cell" colspan="8">No hay solicitudes con estos filtros.</td></tr>';
        return;
      }
      body.innerHTML = data.map(t => `
        <tr data-open-ticket="${t.id}" tabindex="0">
          <td><span class="pq-ticket-code">${esc(t.codigo)}</span></td>
          <td data-label="Cliente">${esc(t.cliente)}<small>${esc(t.email_cuenta)}</small></td>
          <td data-label="Pedido">${esc(t.numero_pedido || '—')}</td>
          <td data-label="Tipo"><span class="pq-type">${esc(TIPOS[t.tipo])}</span></td>
          <td data-label="Asunto">${esc(t.asunto)}${t.prenda ? `<small>${esc(t.prenda)}${t.talla ? ' · ' + esc(t.talla) : ''}</small>` : ''}</td>
          <td>${badge(t.estado)}</td>
          <td data-label="Radicado">${fecha(t.creado_en)}</td>
          <td><i class="fa-solid fa-chevron-right" style="color:var(--pq-gold)"></i></td>
        </tr>`).join('');
    } catch (error) {
      body.innerHTML = `<tr><td class="pq-empty-cell" colspan="8">${esc(error.message)}</td></tr>`;
    }
  }

  /* --------------------------------------------------- detalle del ticket */

  function initDrawer() {
    $$('[data-close-drawer]').forEach(el => el.addEventListener('click', closeDrawer));
    $('#clienteTickets').addEventListener('click', e => {
      const item = e.target.closest('[data-open-ticket]');
      if (item) openTicket(item.dataset.openTicket);
    });
    $('[data-close-lightbox]').addEventListener('click', closeLightbox);
    $('#pqLightbox').addEventListener('click', e => { if (e.target.id === 'pqLightbox') closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('#pqLightbox').hidden) closeLightbox();
      else if (!$('#ticketDrawer').hidden) closeDrawer();
    });
  }

  function releaseUrls() {
    state.objectUrls.forEach(URL.revokeObjectURL);
    state.objectUrls = [];
  }

  function closeDrawer() {
    $('#ticketDrawer').hidden = true;
    document.body.style.overflow = '';
    releaseUrls();
  }

  function closeLightbox() {
    $('#pqLightbox').hidden = true;
  }

  async function openTicket(id) {
    const drawer = $('#ticketDrawer');
    const bodyEl = $('#drawerBody');
    releaseUrls();
    drawer.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#drawerTitle').textContent = 'Cargando…';
    $('#drawerTipo').textContent = '';
    bodyEl.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><span class="pq-spinner"></span></div>';
    try {
      const { data } = await api(`/tickets/${id}`);
      renderTicket(data);
    } catch (error) {
      bodyEl.innerHTML = `<p class="pq-muted">${esc(error.message)}</p>`;
    }
  }

  function renderTicket(t) {
    const isAdmin = state.user.rol === 'admin';
    const cerrado = t.estado === 'cerrado';
    $('#drawerTitle').textContent = t.codigo;
    const esGarantia = t.categoria === 'garantia';
    $('#drawerTipo').innerHTML = `${esGarantia ? 'Garantía' : esc(TIPOS[t.tipo])} · ${badge(t.estado)}`;

    const fotosDe = cat => t.adjuntos.filter(a => a.categoria === cat);
    const gallery = (cat, label) => {
      const list = fotosDe(cat);
      return `<p class="pq-gallery-label">${label} (${list.length})</p>` + (list.length
        ? `<div class="pq-gallery">${list.map(a => `
            <button type="button" data-photo="${a.id}" aria-label="Ver ${esc(a.nombre_original)}"><img alt="${esc(a.nombre_original)}"></button>`).join('')}</div>`
        : '<p class="pq-muted">Sin fotos.</p>');
    };

    const hasLogistics = t.direccion || t.ciudad || t.telefono_contacto || t.especificaciones_recogida || t.especificaciones_entrega;

    $('#drawerBody').innerHTML = `
      <section class="pq-section">
        <h3>Datos de la solicitud</h3>
        <dl class="pq-dl">
          <div><dt>Cliente</dt><dd>${esc(t.cliente)}</dd></div>
          <div><dt>Número de pedido</dt><dd>${esc(t.numero_pedido || 'No aplica')}</dd></div>
          <div><dt>Tipo</dt><dd>${esGarantia ? 'Garantía' : esc(TIPOS[t.tipo])}</dd></div>
          <div><dt>Asunto</dt><dd>${esc(t.asunto)}</dd></div>
          <div><dt>Prenda</dt><dd>${esc(t.prenda || 'No aplica')}</dd></div>
          <div><dt>Talla</dt><dd>${esc(t.talla || 'No aplica')}</dd></div>
          <div><dt>Radicado</dt><dd>${fecha(t.creado_en, true)}</dd></div>
          <div><dt>Última actualización</dt><dd>${fecha(t.actualizado_en, true)}</dd></div>
          ${isAdmin && t.cuenta ? `
          <div class="full"><dt>Cuenta que radicó</dt><dd>${esc(t.cuenta.nombre)} · ${esc(t.cuenta.email)}${t.cuenta.telefono ? ' · ' + esc(t.cuenta.telefono) : ''}${t.cuenta.documento ? ' · Doc. ' + esc(t.cuenta.documento) : ''}</dd></div>` : ''}
        </dl>
      </section>

      <section class="pq-section">
        <h3>Descripción del motivo</h3>
        <div class="pq-desc">${esc(t.descripcion)}</div>
      </section>

      ${esGarantia ? `
      <section class="pq-section">
        <h3>Fotos</h3>
        ${gallery('prelavado', 'Prelavado')}
        <div style="height:14px"></div>
        ${gallery('defecto', 'Parte defectuosa')}
      </section>` : (t.adjuntos.length ? `
      <section class="pq-section">
        <h3>Fotos de soporte</h3>
        ${gallery('defecto', 'Adjuntas por el cliente')}
      </section>` : '')}

      ${esGarantia || hasLogistics ? `<section class="pq-section" id="logisticaSection">
        <h3>Recogida y entrega
          ${!cerrado ? `<button type="button" class="pq-link" id="editLogistica"><i class="fa-solid fa-pen"></i> ${hasLogistics ? 'Editar' : 'Agregar datos'}</button>` : ''}
        </h3>
        <div id="logisticaView">
          ${hasLogistics ? `
          <dl class="pq-dl">
            <div><dt>Dirección</dt><dd>${esc(t.direccion || '—')}</dd></div>
            <div><dt>Ciudad</dt><dd>${esc(t.ciudad || '—')}</dd></div>
            <div><dt>Teléfono de contacto</dt><dd>${esc(t.telefono_contacto || '—')}</dd></div>
            <div class="full"><dt>Especificaciones de recogida</dt><dd class="pq-desc">${esc(t.especificaciones_recogida || '—')}</dd></div>
            <div class="full"><dt>Especificaciones de entrega</dt><dd class="pq-desc">${esc(t.especificaciones_entrega || '—')}</dd></div>
          </dl>` : '<p class="pq-muted">Aún no se han registrado datos de recogida y entrega.</p>'}
        </div>
      </section>` : ''}

      <section class="pq-section">
        <h3>Respuestas y seguimiento</h3>
        <div class="pq-thread">
          ${t.respuestas.length ? t.respuestas.map(r => `
            <div class="pq-msg ${r.autor_rol === 'admin' ? 'admin' : ''} ${r.autor_rol === state.user.rol ? 'mine' : ''}">
              <div class="pq-msg-head">
                <strong>${r.autor_rol === 'admin' ? 'B&amp;F · ' + esc(r.autor) : esc(r.autor)}</strong>
                <span>${fecha(r.creado_en, true)}</span>
              </div>
              <p>${esc(r.mensaje)}</p>
            </div>`).join('') : `<p class="pq-muted">${isAdmin ? 'Todavía no has respondido esta solicitud.' : 'Nuestro equipo aún no ha respondido. Te avisaremos por aquí.'}</p>`}
        </div>
      </section>

      ${(!cerrado || isAdmin) ? `
      <section class="pq-section">
        <h3>${isAdmin ? 'Responder al cliente' : 'Agregar un mensaje'}</h3>
        <form class="pq-reply" id="replyForm" novalidate>
          <label class="pq-field">
            <span class="pq-sr">Mensaje</span>
            <textarea name="mensaje" rows="4" maxlength="5000" placeholder="${isAdmin ? 'Ej: Hola, programamos la recogida del pantalón para el jueves. La garantía fue aprobada.' : 'Escribe aquí si necesitas agregar información.'}"></textarea>
          </label>
          <p class="pq-form-error" data-error></p>
          <div class="pq-reply-actions">
            ${isAdmin ? `
            <label class="pq-field">
              <span>Estado</span>
              <select name="estado">
                ${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${k === (t.estado === 'radicado' || t.estado === 'en_revision' ? 'respondido' : t.estado) ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </label>` : ''}
            <button type="submit" class="pq-btn pq-btn-gold"><i class="fa-solid fa-paper-plane"></i> Enviar</button>
          </div>
        </form>
      </section>` : '<p class="pq-muted">Esta solicitud está cerrada.</p>'}

      ${isAdmin ? `
      <section class="pq-section">
        <h3>Cambiar estado sin responder</h3>
        <div class="pq-reply-actions" style="justify-content:flex-start">
          ${Object.entries(ESTADOS).filter(([k]) => k !== t.estado).map(([k, v]) =>
            `<button type="button" class="pq-btn pq-btn-ghost pq-btn-sm" data-set-estado="${k}">Marcar como ${v.toLowerCase()}</button>`).join('')}
        </div>
      </section>` : ''}
    `;

    loadPhotos(t);
    bindTicketActions(t);
  }

  async function loadPhotos(t) {
    for (const btn of $$('[data-photo]', $('#drawerBody'))) {
      try {
        const res = await fetch(`${API}/tickets/${t.id}/adjuntos/${btn.dataset.photo}`, {
          headers: { Authorization: `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error();
        const url = URL.createObjectURL(await res.blob());
        state.objectUrls.push(url);
        $('img', btn).src = url;
        btn.addEventListener('click', () => {
          const box = $('#pqLightbox');
          $('img', box).src = url;
          $('img', box).alt = $('img', btn).alt;
          box.hidden = false;
        });
      } catch {
        btn.disabled = true;
        btn.title = 'No se pudo cargar la foto';
      }
    }
  }

  function bindTicketActions(t) {
    const reply = $('#replyForm');
    if (reply) {
      reply.addEventListener('submit', async e => {
        e.preventDefault();
        const data = formData(reply);
        setError(reply);
        if (!data.mensaje.trim()) return setError(reply, 'Escribe un mensaje.');
        try {
          await withBusy($('button[type=submit]', reply), () =>
            api(`/tickets/${t.id}/respuestas`, { method: 'POST', body: data }));
          toast(state.user.rol === 'admin' ? 'Respuesta enviada al cliente.' : 'Mensaje enviado.');
          await openTicket(t.id);
          refreshLists();
        } catch (error) {
          setError(reply, error.message);
        }
      });
    }

    $$('[data-set-estado]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await withBusy(btn, () => api(`/tickets/${t.id}/estado`, { method: 'PATCH', body: { estado: btn.dataset.setEstado } }));
        toast(`Estado actualizado: ${ESTADOS[btn.dataset.setEstado]}.`);
        await openTicket(t.id);
        refreshLists();
      } catch (error) {
        toast(error.message, true);
      }
    }));

    const edit = $('#editLogistica');
    if (edit) edit.addEventListener('click', () => {
      edit.hidden = true;
      $('#logisticaView').innerHTML = `
        <form class="pq-form" id="logisticaEdit" novalidate>
          <div class="pq-row">
            <label class="pq-field"><span>Dirección</span><input name="direccion" maxlength="255" value="${esc(t.direccion || '')}"></label>
            <label class="pq-field"><span>Ciudad</span><input name="ciudad" maxlength="100" value="${esc(t.ciudad || '')}"></label>
          </div>
          <label class="pq-field"><span>Teléfono de contacto</span><input name="telefonoContacto" maxlength="40" value="${esc(t.telefono_contacto || '')}"></label>
          <label class="pq-field"><span>Especificaciones de recogida</span><textarea name="especificacionesRecogida" rows="3" maxlength="2000">${esc(t.especificaciones_recogida || '')}</textarea></label>
          <label class="pq-field"><span>Especificaciones de entrega</span><textarea name="especificacionesEntrega" rows="3" maxlength="2000">${esc(t.especificaciones_entrega || '')}</textarea></label>
          <p class="pq-form-error" data-error></p>
          <div class="pq-form-actions">
            <button type="button" class="pq-btn pq-btn-ghost pq-btn-sm" data-cancel>Cancelar</button>
            <button type="submit" class="pq-btn pq-btn-gold pq-btn-sm">Guardar</button>
          </div>
        </form>`;
      const formL = $('#logisticaEdit');
      $('[data-cancel]', formL).addEventListener('click', () => openTicket(t.id));
      formL.addEventListener('submit', async e => {
        e.preventDefault();
        try {
          await withBusy($('button[type=submit]', formL), () =>
            api(`/tickets/${t.id}/logistica`, { method: 'PATCH', body: formData(formL) }));
          toast('Datos de recogida y entrega guardados.');
          openTicket(t.id);
        } catch (error) {
          setError(formL, error.message);
        }
      });
    });
  }

  function refreshLists() {
    if (state.user.rol === 'admin') loadAdmin();
    else loadClientTickets();
  }

  /* ------------------------------------------------ navegación del administrador */

  function goAdmin(name) {
    const section = name === 'pqrs' || name === 'garantia' ? 'tickets' : name;
    $$('[data-admin-section]').forEach(p => { p.hidden = p.dataset.adminSection !== section; });
    window.scrollTo({ top: 0 });
    if (section === 'inicio') return loadAdminPanel();
    if (section === 'tickets') {
      state.categoria = name;
      const g = name === 'garantia';
      $('#adminTicketsTitle').textContent = g ? 'Gestionar garantías' : 'Gestionar PQRS';
      $('#filtroTipo').hidden = g;
      $('#adminFilters').reset();
      $('.pq-report-print-head strong').textContent = g ? 'Reporte de garantías' : 'Reporte de PQRS';
      $('[data-admin-tab="tickets"]').click();
    }
    if (section === 'hojas') {
      $('[data-hv-tab="lista"]').click();
      loadCargos();
    }
    if (section === 'contenido') {
      $('[data-ct-tab="textos"]').click();
    }
  }

  async function loadAdminPanel() {
    try {
      const { data } = await api('/admin/panel');
      $$('[data-badge]').forEach(b => {
        const n = data[b.dataset.badge] || 0;
        b.hidden = !n;
        b.textContent = n;
        b.title = `${n} sin revisar`;
      });
      $('#tileCargos').textContent = `${data.cargosActivos} de ${data.cargosTotal} cargos abiertos`;
    } catch { /* el panel funciona sin contadores */ }
  }

  /* -------------------------------------------------------------- hojas de vida */

  const EXPERIENCIA = { sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año', entre_1_3: 'Entre 1 y 3 años', mas_3: 'Más de 3 años' };
  const ESTADOS_HV = { nueva: 'Nueva', revisada: 'Revisada', preseleccionada: 'Preseleccionada', descartada: 'Descartada' };
  const hvBadge = e => `<span class="pq-badge pq-badge-${esc(e)}">${esc(ESTADOS_HV[e] || e)}</span>`;
  let hvTimer;

  function initHojas() {
    $$('[data-hv-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-hv-tab]').forEach(t => t.classList.toggle('active', t === tab));
      $$('[data-hv-panel]').forEach(p => { p.hidden = p.dataset.hvPanel !== tab.dataset.hvTab; });
      if (tab.dataset.hvTab === 'lista') loadHojas();
      else loadCargos();
    }));
    const filters = $('#hvFilters');
    filters.addEventListener('submit', e => e.preventDefault());
    filters.addEventListener('input', e => {
      clearTimeout(hvTimer);
      hvTimer = setTimeout(loadHojas, e.target.name === 'q' ? 300 : 0);
    });
    $('#hvTabla').addEventListener('click', e => {
      const row = e.target.closest('[data-open-hv]');
      if (row) openHoja(row.dataset.openHv);
    });
    $('#hvTabla').addEventListener('keydown', e => {
      const row = e.target.closest('[data-open-hv]');
      if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openHoja(row.dataset.openHv); }
    });
    $$('[data-close-hv]').forEach(el => el.addEventListener('click', closeHoja));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#hvDrawer').hidden) closeHoja(); });

    $('#cargosLista').addEventListener('change', async e => {
      const input = e.target.closest('[data-cargo]');
      if (!input) return;
      try {
        await api(`@/empleo/admin/cargos/${input.dataset.cargo}`, { method: 'PATCH', body: { activo: input.checked } });
        input.closest('.pq-cargo').classList.toggle('off', !input.checked);
        toast(input.checked ? 'Cargo activado: ya aparece en el formulario.' : 'Cargo desactivado: ya no recibe hojas de vida.');
      } catch (error) {
        input.checked = !input.checked;
        toast(error.message, true);
      }
    });
    $$('[data-cargos-todos]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await withBusy(btn, () => api('@/empleo/admin/cargos', { method: 'PATCH', body: { activo: btn.dataset.cargosTodos === '1' } }));
        loadCargos();
      } catch (error) {
        toast(error.message, true);
      }
    }));
    const fc = $('#formCargo');
    fc.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(fc);
      if (String(data.nombre || '').trim().length < 3) return markInvalid(fc, ['nombre']);
      try {
        await withBusy($('button[type=submit]', fc), () => api('@/empleo/admin/cargos', { method: 'POST', body: data }));
        fc.reset();
        toast('Cargo agregado y activo.');
        loadCargos();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  async function loadCargos() {
    try {
      const { data } = await api('@/empleo/admin/cargos');
      const sel = $('#hvFiltroCargo');
      const actual = sel.value;
      sel.innerHTML = '<option value="">Todos los cargos</option>' +
        data.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
      sel.value = actual;
      const areas = {};
      data.forEach(c => { (areas[c.area] = areas[c.area] || []).push(c); });
      $('#cargosLista').innerHTML = Object.entries(areas).map(([area, list]) => `
        <h3>${esc(area)}</h3>
        ${list.map(c => `
          <label class="pq-cargo ${c.activo ? '' : 'off'}">
            <span class="pq-cargo-name">${esc(c.nombre)}
              <small>${Number(c.total)} hoja(s) de vida${Number(c.nuevas) ? ` · ${c.nuevas} nueva(s)` : ''}</small></span>
            <span class="pq-switch"><input type="checkbox" data-cargo="${c.id}" ${c.activo ? 'checked' : ''} aria-label="Recibir hojas de vida para ${esc(c.nombre)}"><span></span></span>
          </label>`).join('')}`).join('');
    } catch (error) {
      $('#cargosLista').innerHTML = `<p class="pq-muted">${esc(error.message)}</p>`;
    }
  }

  async function loadHojas() {
    const f = $('#hvFilters');
    const params = new URLSearchParams();
    ['q', 'estado', 'cargo'].forEach(k => { if (f.elements[k].value) params.set(k, f.elements[k].value.trim()); });
    const body = $('#hvTabla');
    try {
      const { data } = await api('@/empleo/admin/hojas-vida?' + params);
      if (!data.length) {
        body.innerHTML = '<tr><td class="pq-empty-cell" colspan="7">No hay hojas de vida con estos filtros.</td></tr>';
        return;
      }
      body.innerHTML = data.map(h => `
        <tr data-open-hv="${h.id}" tabindex="0">
          <td><span class="pq-ticket-code">${esc(h.codigo)}</span></td>
          <td data-label="Aspirante">${esc(h.nombre)}<small>${esc(h.email)} · ${esc(h.telefono)}</small></td>
          <td data-label="Cargo">${esc(h.cargo_nombre)}</td>
          <td data-label="Experiencia">${esc(EXPERIENCIA[h.experiencia])}</td>
          <td>${hvBadge(h.estado)}</td>
          <td data-label="Recibida">${fecha(h.creado_en)}</td>
          <td><i class="fa-solid fa-chevron-right" style="color:var(--pq-gold)"></i></td>
        </tr>`).join('');
    } catch (error) {
      body.innerHTML = `<tr><td class="pq-empty-cell" colspan="7">${esc(error.message)}</td></tr>`;
    }
  }

  function closeHoja() {
    $('#hvDrawer').hidden = true;
    document.body.style.overflow = '';
  }

  async function openHoja(id) {
    $('#hvDrawer').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#hvTitle').textContent = 'Cargando…';
    $('#hvCargo').textContent = '';
    const bodyEl = $('#hvBody');
    bodyEl.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><span class="pq-spinner"></span></div>';
    try {
      const { data: h } = await api(`@/empleo/admin/hojas-vida/${id}`);
      $('#hvTitle').textContent = h.nombre;
      $('#hvCargo').innerHTML = `${esc(h.codigo)} · ${hvBadge(h.estado)}`;
      bodyEl.innerHTML = `
        <section class="pq-section">
          <h3>Datos del aspirante</h3>
          <dl class="pq-dl">
            <div><dt>Cargo</dt><dd>${esc(h.cargo_nombre)}</dd></div>
            <div><dt>Experiencia</dt><dd>${esc(EXPERIENCIA[h.experiencia])}</dd></div>
            <div><dt>Correo</dt><dd><a class="pq-link" href="mailto:${esc(h.email)}">${esc(h.email)}</a></dd></div>
            <div><dt>Teléfono</dt><dd><a class="pq-link" href="tel:${esc(h.telefono.replace(/\s/g, ''))}">${esc(h.telefono)}</a></dd></div>
            <div><dt>Recibida</dt><dd>${fecha(h.creado_en, true)}</dd></div>
            <div><dt>Autorizó datos</dt><dd>${fecha(h.autoriza_datos, true)}</dd></div>
          </dl>
        </section>
        <section class="pq-section">
          <h3>Sobre el aspirante</h3>
          <div class="pq-desc">${esc(h.descripcion || 'No escribió una descripción.')}</div>
        </section>
        <section class="pq-section">
          <h3>Hoja de vida</h3>
          <button type="button" class="pq-btn pq-btn-gold" id="hvDescargar">
            <i class="fa-solid fa-download"></i> Descargar ${esc(h.nombre_original)}
          </button>
        </section>
        <section class="pq-section">
          <h3>Seguimiento</h3>
          <form class="pq-reply" id="hvForm" novalidate>
            <label class="pq-field"><span>Notas internas</span>
              <textarea name="notas" rows="3" maxlength="3000" placeholder="Ej: Llamar el lunes para entrevista.">${esc(h.notas || '')}</textarea>
            </label>
            <div class="pq-reply-actions">
              <label class="pq-field"><span>Estado</span>
                <select name="estado">${Object.entries(ESTADOS_HV).map(([k, v]) => `<option value="${k}" ${k === h.estado ? 'selected' : ''}>${v}</option>`).join('')}</select>
              </label>
              <button type="submit" class="pq-btn pq-btn-gold"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
            </div>
          </form>
        </section>
        <section class="pq-section">
          <h3>Eliminar</h3>
          <p class="pq-muted" style="margin-bottom:10px">Borra la postulación y el archivo de forma definitiva, por ejemplo si el aspirante lo pide.</p>
          <button type="button" class="pq-btn pq-btn-danger pq-btn-sm" id="hvEliminar"><i class="fa-solid fa-trash"></i> Eliminar hoja de vida</button>
        </section>`;
      $('#hvDescargar').addEventListener('click', async e => {
        try {
          await withBusy(e.currentTarget, async () => {
            const res = await fetch(`/api/empleo/admin/hojas-vida/${h.id}/archivo`, { headers: { Authorization: `Bearer ${state.token}` } });
            if (!res.ok) throw new Error('No se pudo descargar el archivo.');
            const url = URL.createObjectURL(await res.blob());
            const a = Object.assign(document.createElement('a'), { href: url, download: h.nombre_original });
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          });
          if (h.estado === 'nueva') { loadHojas(); openHoja(h.id); }
        } catch (error) {
          toast(error.message, true);
        }
      });
      $('#hvForm').addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.currentTarget;
        try {
          await withBusy($('button[type=submit]', f), () => api(`@/empleo/admin/hojas-vida/${h.id}`, { method: 'PATCH', body: formData(f) }));
          toast('Seguimiento guardado.');
          loadHojas();
          openHoja(h.id);
        } catch (error) {
          toast(error.message, true);
        }
      });
      const del = $('#hvEliminar');
      del.addEventListener('click', async () => {
        if (del.dataset.confirm !== '1') {
          del.dataset.confirm = '1';
          del.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Haz clic otra vez para confirmar';
          setTimeout(() => { if (del.isConnected) { del.dataset.confirm = ''; del.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar hoja de vida'; } }, 4000);
          return;
        }
        try {
          await withBusy(del, () => api(`@/empleo/admin/hojas-vida/${h.id}`, { method: 'DELETE' }));
          closeHoja();
          toast('Hoja de vida eliminada.');
          loadHojas();
        } catch (error) {
          toast(error.message, true);
        }
      });
    } catch (error) {
      bodyEl.innerHTML = `<p class="pq-muted">${esc(error.message)}</p>`;
    }
  }

  /* ------------------------------------------------------------- contenido */

  let noticiaImagen = null;
  let noticiasCache = [];

  function initContenido() {
    $$('[data-ct-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-ct-tab]').forEach(t => t.classList.toggle('active', t === tab));
      $$('[data-ct-panel]').forEach(p => { p.hidden = p.dataset.ctPanel !== tab.dataset.ctTab; });
      if (tab.dataset.ctTab === 'textos') loadTextos();
      else { resetNoticia(); loadNoticias(); }
    }));

    const ft = $('#formTextos');
    ft.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(ft);
      setError(ft);
      const missing = Object.keys(data).filter(k => !String(data[k]).trim());
      if (missing.length) {
        setError(ft, 'Ningún texto puede quedar vacío.');
        return markInvalid(ft, missing);
      }
      try {
        await withBusy($('button[type=submit]', ft), () => api('@/contenido/admin/textos', { method: 'PUT', body: data }));
        toast('Textos guardados. Ya se ven en el sitio.');
      } catch (error) {
        setError(ft, error.message);
      }
    });

    const fn = $('#formNoticia');
    $('#noticiaImagen').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('La imagen debe ser JPG, PNG o WEBP.', true);
      try {
        noticiaImagen = { nombre: file.name, datos: await compressImage(file) };
        const prev = $('#noticiaPreview');
        prev.src = noticiaImagen.datos;
        prev.hidden = false;
      } catch {
        toast('No se pudo leer la imagen.', true);
      }
    });
    $('#noticiaCancelar').addEventListener('click', resetNoticia);
    fn.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(fn);
      setError(fn);
      const missing = ['titulo', 'fecha', 'resumen'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(fn, 'Completa los campos obligatorios (*).');
        return markInvalid(fn, missing);
      }
      if (!data.id && !noticiaImagen) return setError(fn, 'Agrega una imagen para la noticia.');
      const body = { titulo: data.titulo, fecha: data.fecha, resumen: data.resumen, visible: fn.elements.visible.checked, imagen: noticiaImagen || undefined };
      try {
        await withBusy($('button[type=submit]', fn), () => data.id
          ? api(`@/contenido/admin/noticias/${data.id}`, { method: 'PUT', body })
          : api('@/contenido/admin/noticias', { method: 'POST', body }));
        toast(data.id ? 'Noticia actualizada.' : 'Noticia publicada.');
        resetNoticia();
        loadNoticias();
      } catch (error) {
        setError(fn, error.message);
      }
    });

    $('#noticiasLista').addEventListener('click', async e => {
      const btn = e.target.closest('[data-news-action]');
      if (!btn) return;
      const n = noticiasCache.find(x => String(x.id) === btn.dataset.id);
      if (!n) return;
      const action = btn.dataset.newsAction;
      if (action === 'editar') return editNoticia(n);
      try {
        if (action === 'visible') {
          await api(`@/contenido/admin/noticias/${n.id}`, { method: 'PATCH', body: { visible: !n.visible } });
          toast(n.visible ? 'Noticia oculta del sitio.' : 'Noticia visible en el sitio.');
        }
        if (action === 'eliminar') {
          if (btn.dataset.confirm !== '1') {
            btn.dataset.confirm = '1';
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            btn.title = 'Haz clic otra vez para eliminar';
            toast('Haz clic otra vez en el botón para eliminar la noticia.');
            return;
          }
          await api(`@/contenido/admin/noticias/${n.id}`, { method: 'DELETE' });
          toast('Noticia eliminada.');
        }
        loadNoticias();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  async function loadTextos() {
    try {
      const { data } = await api('@/contenido/textos');
      const ft = $('#formTextos');
      Object.entries(data).forEach(([k, v]) => { if (ft.elements[k]) ft.elements[k].value = v; });
    } catch (error) {
      toast(error.message, true);
    }
  }

  function resetNoticia() {
    const fn = $('#formNoticia');
    fn.reset();
    fn.elements.id.value = '';
    fn.elements.fecha.value = isoDay(new Date());
    fn.elements.visible.checked = true;
    noticiaImagen = null;
    $('#noticiaPreview').hidden = true;
    $('#noticiaFormTitulo').textContent = 'Nueva noticia';
    $('#noticiaCancelar').hidden = true;
    markInvalid(fn, []);
    setError(fn);
  }

  function editNoticia(n) {
    const fn = $('#formNoticia');
    resetNoticia();
    fn.elements.id.value = n.id;
    fn.elements.titulo.value = n.titulo;
    fn.elements.fecha.value = n.fecha;
    fn.elements.resumen.value = n.resumen;
    fn.elements.visible.checked = n.visible;
    if (n.imagen) {
      const prev = $('#noticiaPreview');
      prev.src = n.imagen + (n.imagen.includes('?') ? '&' : '?') + 'admin=1';
      prev.hidden = false;
    }
    $('#noticiaFormTitulo').textContent = 'Editar noticia';
    $('#noticiaCancelar').hidden = false;
    fn.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadNoticias() {
    const box = $('#noticiasLista');
    try {
      const { data } = await api('@/contenido/admin/noticias');
      noticiasCache = data;
      if (!data.length) {
        box.innerHTML = '<div class="pq-empty"><i class="fa-regular fa-newspaper"></i>Aún no hay noticias.</div>';
        return;
      }
      box.innerHTML = data.map(n => `
        <div class="pq-news-item ${n.visible ? '' : 'off'}">
          ${n.imagen ? `<img src="${esc(n.imagen + (n.imagen.includes('?') ? '&' : '?') + 'admin=1')}" alt="">` : '<span></span>'}
          <div>
            <strong>${esc(n.titulo)}</strong>
            <small>${fecha(n.fecha + 'T12:00:00')} · ${n.visible ? 'Visible en el sitio' : 'Oculta'}</small>
          </div>
          <div class="pq-news-actions">
            <button type="button" class="pq-icon-btn" data-news-action="editar" data-id="${n.id}" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="pq-icon-btn" data-news-action="visible" data-id="${n.id}" title="${n.visible ? 'Ocultar' : 'Mostrar'}" aria-label="${n.visible ? 'Ocultar' : 'Mostrar'}"><i class="fa-regular ${n.visible ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
            <button type="button" class="pq-icon-btn" data-news-action="eliminar" data-id="${n.id}" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`).join('');
    } catch (error) {
      box.innerHTML = `<p class="pq-muted">${esc(error.message)}</p>`;
    }
  }

  /* ---------------------------------------------------------------- inicio */

  async function init() {
    initAuth();
    initClient();
    initAdmin();
    initDrawer();
    // Al corregir un campo marcado en rojo se quita la marca
    document.addEventListener('input', e => e.target.closest?.('.pq-field')?.classList.remove('invalid'));
    document.addEventListener('change', e => e.target.closest?.('.pq-field')?.classList.remove('invalid'));
    // Enlace del correo: pqrs.html#restablecer=<código>. Se quita de la barra de direcciones.
    const reset = location.hash.match(/^#restablecer=([0-9a-f]{64})$/);
    if (reset) {
      state.resetToken = reset[1];
      history.replaceState(null, '', location.pathname + location.search);
    }
    await refreshStatus();
    if (state.resetToken) {
      showView('viewAuth');
      showAuthPanel('restablecer');
      return;
    }
    if (state.token) {
      try {
        const { data } = await api('/auth/yo');
        state.user = data;
        enterApp();
        return;
      } catch {
        storage.set(null);
        state.token = null;
      }
    }
    showView('viewAuth');
    if (location.hash === '#registro') showAuthPanel('registro');
  }

  init();
})();
