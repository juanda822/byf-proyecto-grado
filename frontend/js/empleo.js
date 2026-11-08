/* ==========================================================================
   EMPLEO.JS - Página "Trabaja con nosotros"
   ========================================================================== */
(() => {
  'use strict';

  const MAX_BYTES = 5 * 1024 * 1024;
  const EXT_OK = /\.(pdf|docx?)$/i;
  const $ = (sel, root = document) => root.querySelector(sel);

  const form = $('#formEmpleo');
  const select = $('#cargoSelect');
  const cvInput = $('#cvInput');
  let cv = null; // { nombre, datos }

  function toast(message, isError = false) {
    const el = $('#pqToast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 4000);
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* -------------------------------------------------- textos editables */
  async function loadTextos() {
    try {
      const res = await fetch('/api/contenido/textos');
      const { data } = await res.json();
      document.querySelectorAll('[data-texto]').forEach(el => {
        if (data && data[el.dataset.texto]) el.textContent = data[el.dataset.texto];
      });
    } catch { /* se mantienen los textos por defecto */ }
  }

  /* -------------------------------------------------------------- cargos */
  async function loadCargos() {
    try {
      const res = await fetch('/api/empleo/cargos');
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      if (!body.data.length) {
        form.hidden = true;
        $('#empleoCerrado').hidden = false;
        return;
      }
      const areas = {};
      body.data.forEach(c => { (areas[c.area] = areas[c.area] || []).push(c); });
      select.innerHTML = '<option value="">Selecciona un cargo</option>' + Object.entries(areas).map(([area, list]) =>
        `<optgroup label="${esc(area)}">${list.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</optgroup>`
      ).join('');
    } catch {
      select.innerHTML = '<option value="">No se pudieron cargar los cargos</option>';
      setError('No pudimos conectar con el servidor. Inténtalo de nuevo en unos minutos.');
    }
  }

  /* ---------------------------------------------------------- hoja de vida */
  function setFile(file) {
    if (!file) return;
    if (!EXT_OK.test(file.name)) {
      toast('La hoja de vida debe estar en PDF o Word (.doc o .docx).', true);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('El archivo supera los 5 MB. Intenta con una versión más liviana.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      cv = { nombre: file.name, datos: reader.result };
      $('#cvName').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
      $('#cvFile').hidden = false;
      $('#cvDrop').hidden = true;
      $('#cvDrop').classList.remove('invalid');
    };
    reader.onerror = () => toast('No se pudo leer el archivo.', true);
    reader.readAsDataURL(file);
  }

  cvInput.addEventListener('change', () => { setFile(cvInput.files[0]); cvInput.value = ''; });
  const drop = $('#cvDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));
  $('#cvRemove').addEventListener('click', () => {
    cv = null;
    $('#cvFile').hidden = true;
    $('#cvDrop').hidden = false;
  });

  /* ------------------------------------------------------------- envío */
  function setError(msg) { $('[data-error]', form).textContent = msg || ''; }

  function mark(names) {
    form.querySelectorAll('.pq-field, .em-check').forEach(f => f.classList.remove('invalid'));
    names.forEach(n => form.elements[n]?.closest('.pq-field, .em-check')?.classList.add('invalid'));
    if (names[0] && form.elements[names[0]]) form.elements[names[0]].focus();
  }

  form.addEventListener('input', e => { e.target.closest('.pq-field, .em-check')?.classList.remove('invalid'); setError(''); });
  form.addEventListener('change', e => { e.target.closest('.pq-field, .em-check')?.classList.remove('invalid'); setError(''); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(form).entries());
    const missing = ['nombre', 'email', 'telefono', 'cargoId'].filter(k => !String(data[k] || '').trim());
    if (missing.length) {
      setError('Completa los campos obligatorios (*).');
      return mark(missing);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      setError('Escribe un correo electrónico válido.');
      return mark(['email']);
    }
    if (!cv) {
      setError('Adjunta tu hoja de vida en PDF o Word.');
      $('#cvDrop').classList.add('invalid');
      return;
    }
    if (!form.elements.autorizaDatos.checked) {
      setError('Debes autorizar el tratamiento de tus datos personales para enviar la postulación.');
      return mark(['autorizaDatos']);
    }
    mark([]);

    const btn = $('button[type=submit]', form);
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="pq-spinner"></span> Enviando…';
    try {
      const res = await fetch('/api/empleo/postulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: data.nombre,
          email: data.email,
          telefono: data.telefono,
          cargoId: Number(data.cargoId),
          experiencia: data.experiencia,
          descripcion: data.descripcion,
          sitio: data.sitio,
          autorizaDatos: true,
          hojaVida: cv
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || 'No se pudo enviar la postulación.');
      $('#empleoCodigo').textContent = body.data.codigo;
      form.hidden = true;
      $('#empleoListo').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setError(error.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Inténtalo de nuevo.' : error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  loadTextos();
  loadCargos();
})();
