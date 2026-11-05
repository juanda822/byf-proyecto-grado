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

  const storage = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: v => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* */ } }
  };

  const state = {
    token: storage.get(),
    user: null,
    status: null,
    lastTicket: null,
    fotos: { prelavado: [], defecto: [] },
    objectUrls: []
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
      response = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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
    box.hidden = false;
    $('#pqSessionRole').textContent = state.user.rol === 'admin' ? 'Administrador' : 'Cliente';
    $('#pqSessionName').textContent = state.user.nombre;
  }

  function enterApp() {
    renderSession();
    if (state.user.rol === 'admin') {
      showView('viewAdmin');
      loadAdmin();
    } else {
      $('#clienteNombre').textContent = state.user.nombre;
      showView('viewCliente');
      resetWizard();
      loadClientTickets();
    }
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

  function initAuth() {
    $$('[data-auth-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-auth-tab]').forEach(t => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      $$('[data-auth-panel]').forEach(p => { p.hidden = p.dataset.authPanel !== tab.dataset.authTab; });
    }));

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
      const missing = ['nombre', 'email', 'password', 'password2'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(form, 'Completa los campos obligatorios (*).');
        return markInvalid(form, missing);
      }
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
    $$('[data-client-tab]').forEach(tab => tab.addEventListener('click', () => switchClientTab(tab.dataset.clientTab)));

    const form = $('#formTicket');
    form.elements.tipo.addEventListener('change', () => {
      const label = TIPOS[form.elements.tipo.value];
      $('#asuntoLabel').textContent = label ? `Describa su ${label.toLowerCase()} *` : 'Describa su petición, queja o reclamo *';
    });

    $$('[data-upload]').forEach(initUpload);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = formData(form);
      setError(form);
      const missing = ['cliente', 'numeroPedido', 'tipo', 'asunto', 'descripcion'].filter(k => !String(data[k] || '').trim());
      if (missing.length) {
        setError(form, 'Completa los campos obligatorios (*).');
        return markInvalid(form, missing);
      }
      if (data.descripcion.trim().length < 10) {
        setError(form, 'Describe el motivo con un poco más de detalle.');
        return markInvalid(form, ['descripcion']);
      }
      markInvalid(form, []);
      const body = {
        ...data,
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
        loadClientTickets();
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
      switchClientTab('mis');
      openTicket(state.lastTicket.id);
    });
  }

  function switchClientTab(name) {
    $$('[data-client-tab]').forEach(t => t.classList.toggle('active', t.dataset.clientTab === name));
    $$('[data-client-panel]').forEach(p => { p.hidden = p.dataset.clientPanel !== name; });
    if (name === 'mis') loadClientTickets();
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
    form.elements.tipo.dispatchEvent(new Event('change'));
    state.fotos = { prelavado: [], defecto: [] };
    $$('[data-upload]').forEach(renderThumbs);
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
            <strong>${esc(TIPOS[t.tipo])} · ${esc(t.asunto)}</strong>
            <small>Pedido ${esc(t.numero_pedido)}${t.prenda ? ' · ' + esc(t.prenda) : ''}${t.talla ? ' · ' + esc(t.talla) : ''}</small>
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
    $('#adminRefresh').addEventListener('click', loadAdmin);
    $('#adminTickets').addEventListener('click', e => {
      const row = e.target.closest('[data-open-ticket]');
      if (row) openTicket(row.dataset.openTicket);
    });
    $('#adminTickets').addEventListener('keydown', e => {
      const row = e.target.closest('[data-open-ticket]');
      if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTicket(row.dataset.openTicket); }
    });
  }

  function loadAdmin() {
    loadAdminStats();
    loadAdminTickets();
  }

  async function loadAdminStats() {
    try {
      const { data } = await api('/admin/resumen');
      $$('[data-stat]').forEach(el => { el.textContent = data[el.dataset.stat] ?? 0; });
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function loadAdminTickets() {
    const filters = $('#adminFilters');
    const params = new URLSearchParams();
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
          <td data-label="Pedido">${esc(t.numero_pedido)}</td>
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
    $('#drawerTipo').innerHTML = `${esc(TIPOS[t.tipo])} · ${badge(t.estado)}`;

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
          <div><dt>Número de pedido</dt><dd>${esc(t.numero_pedido)}</dd></div>
          <div><dt>Tipo</dt><dd>${esc(TIPOS[t.tipo])}</dd></div>
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

      <section class="pq-section">
        <h3>Fotos</h3>
        ${gallery('prelavado', 'Prelavado')}
        <div style="height:14px"></div>
        ${gallery('defecto', 'Parte defectuosa')}
      </section>

      <section class="pq-section" id="logisticaSection">
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
      </section>

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

  /* ---------------------------------------------------------------- inicio */

  async function init() {
    initAuth();
    initClient();
    initAdmin();
    initDrawer();
    // Al corregir un campo marcado en rojo se quita la marca
    document.addEventListener('input', e => e.target.closest?.('.pq-field')?.classList.remove('invalid'));
    document.addEventListener('change', e => e.target.closest?.('.pq-field')?.classList.remove('invalid'));
    await refreshStatus();
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
    if (location.hash === '#registro') $('[data-auth-tab="registro"]').click();
  }

  init();
})();
