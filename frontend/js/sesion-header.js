/* ==========================================================================
   SESION-HEADER.JS - Muestra en el encabezado quién inició sesión
   --------------------------------------------------------------------------
   Si el visitante tiene una sesión activa (cliente o administrador), el botón
   "Inicia sesión" del encabezado se reemplaza por su nombre, con un menú para
   volver a su panel o cerrar sesión. Se usa en todas las páginas públicas.
   ========================================================================== */
(() => {
  'use strict';

  const TOKEN_KEY = 'byf_pqrs_token';
  const USER_KEY = 'byf_pqrs_user';
  const API_YO = '/api/pqrs/auth/yo';

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const remove = key => { try { localStorage.removeItem(key); } catch { /* */ } };
  const cachedUser = () => { try { return JSON.parse(read(USER_KEY)); } catch { return null; } };
  const saveUser = u => { try { localStorage.setItem(USER_KEY, JSON.stringify({ nombre: u.nombre, rol: u.rol })); } catch { /* */ } };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** "Juan David Sánchez" → "JS" */
  function initials(nombre) {
    const parts = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  const firstName = nombre => String(nombre || '').trim().split(/\s+/)[0] || 'Mi cuenta';
  const roleLabel = rol => (rol === 'admin' ? 'Administrador' : 'Cliente');

  const originals = new Map();

  function renderUser(user) {
    document.querySelectorAll('.byf-pqrs-btn, .byf-account').forEach((el, i) => {
      const host = el.classList.contains('byf-account') ? el : null;
      const anchor = host ? originals.get(host) : el;
      const wrap = host || document.createElement('div');
      if (!host) {
        originals.set(wrap, anchor);
        wrap.className = 'byf-account';
        anchor.replaceWith(wrap);
      }
      const menuId = `byfAccountMenu${i}`;
      wrap.classList.toggle('is-admin', user.rol === 'admin');
      wrap.innerHTML = `
        <button type="button" class="byf-account-btn" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}"
          title="Sesión iniciada como ${esc(user.nombre)}">
          <span class="byf-account-avatar" aria-hidden="true">${esc(initials(user.nombre))}</span>
          <span class="byf-account-name">${esc(firstName(user.nombre))}</span>
          <i class="fa-solid fa-chevron-down byf-account-caret" aria-hidden="true"></i>
        </button>
        <div class="byf-account-menu" id="${menuId}" role="menu" hidden>
          <div class="byf-account-head">
            <span class="byf-account-avatar lg" aria-hidden="true">${esc(initials(user.nombre))}</span>
            <span>
              <strong>${esc(user.nombre)}</strong>
              <small><i class="fa-solid ${user.rol === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i> ${roleLabel(user.rol)}</small>
            </span>
          </div>
          <a href="pqrs.html" role="menuitem"><i class="fa-solid fa-gauge-high"></i> ${user.rol === 'admin' ? 'Panel de administración' : 'Mi panel'}</a>
          <button type="button" role="menuitem" data-byf-logout><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button>
        </div>`;
    });
  }

  function restoreButtons() {
    document.querySelectorAll('.byf-account').forEach(wrap => {
      const anchor = originals.get(wrap);
      if (anchor) wrap.replaceWith(anchor);
    });
    originals.clear();
  }

  function closeMenus(except) {
    document.querySelectorAll('.byf-account-menu').forEach(menu => {
      if (menu === except) return;
      menu.hidden = true;
      const btn = menu.parentElement.querySelector('.byf-account-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function logout() {
    remove(TOKEN_KEY);
    remove(USER_KEY);
    closeMenus();
    restoreButtons();
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.byf-account-btn');
    if (btn) {
      const menu = btn.parentElement.querySelector('.byf-account-menu');
      const open = menu.hidden;
      closeMenus(menu);
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('a, button')?.focus();
      return;
    }
    if (e.target.closest('[data-byf-logout]')) { logout(); return; }
    if (!e.target.closest('.byf-account-menu')) closeMenus();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.byf-account-menu:not([hidden])');
    if (!open) return;
    closeMenus();
    open.parentElement.querySelector('.byf-account-btn')?.focus();
  });

  async function init() {
    const token = read(TOKEN_KEY);
    if (!token) { remove(USER_KEY); return; }

    // Pinta de inmediato con el nombre guardado para evitar el parpadeo.
    const cached = cachedUser();
    if (cached?.nombre) renderUser(cached);

    // Confirma con el servidor que la sesión sigue vigente.
    try {
      const res = await fetch(API_YO, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) { logout(); return; }
      if (!res.ok) return; // Servidor caído: se deja lo que ya se mostró.
      const { data } = await res.json();
      if (data?.nombre) { saveUser(data); renderUser(data); }
    } catch { /* sin conexión: se conserva la vista actual */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
