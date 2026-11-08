/* ==========================================================================
   CONTENIDO.JS - Textos y noticias que el administrador edita desde el panel
   Si el servidor no responde, la página conserva el contenido escrito en el HTML.
   ========================================================================== */
(() => {
  'use strict';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return (await res.json()).data;
  }

  async function textos() {
    try {
      const data = await getJson('/api/contenido/textos');
      document.querySelectorAll('[data-texto]').forEach(el => {
        if (data[el.dataset.texto]) el.textContent = data[el.dataset.texto];
      });
    } catch { /* textos por defecto */ }
  }

  async function noticias() {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    try {
      const data = await getJson('/api/contenido/noticias');
      if (!data.length) return;
      grid.innerHTML = data.slice(0, 6).map(n => {
        const [y, m, d] = n.fecha.split('-').map(Number);
        return `
        <article class="news-card">
          ${n.imagen ? `<div class="news-image-wrap"><img src="${esc(n.imagen)}" alt="${esc(n.titulo)}" class="news-image" loading="lazy"></div>` : ''}
          <div class="news-body">
            <time class="news-date" datetime="${esc(n.fecha)}">${MESES[m - 1]} ${d}, ${y}</time>
            <h3 class="news-title">${esc(n.titulo)}</h3>
            <p class="news-excerpt">${esc(n.resumen)}</p>
          </div>
        </article>`;
      }).join('');
    } catch { /* noticias escritas en el HTML */ }
  }

  textos();
  noticias();
})();
