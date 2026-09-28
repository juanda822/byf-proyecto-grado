/**
 * modals.js - Control de Modales, Video Corporativo y Avisos Toast
 */

// Función Global para Notificaciones Toast
function showToast(message, type = 'success') {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> <span>${message}</span>`;
  toast.className = `toast-notification ${type} active`;

  setTimeout(() => {
    toast.classList.remove('active');
  }, 4500);
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Manejo del Modal de Video Corporativo
  const videoTrigger = document.getElementById('playCorporateVideo');
  const videoModal = document.getElementById('videoModal');
  const videoFrame = document.getElementById('corporateVideoFrame');

  if (videoTrigger && videoModal) {
    videoTrigger.addEventListener('click', () => {
      videoModal.classList.add('active');
      // Video showcase de fábrica textil de alta resolución
      if (videoFrame) {
        videoFrame.src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'; // o fallback institucional
      }
    });
  }

  // 2. Manejo de Modales de Cotización
  const quoteModal = document.getElementById('quoteModal');
  const openQuoteBtns = document.querySelectorAll('.trigger-quote-modal');
  const serviceSelect = document.getElementById('quoteService');

  openQuoteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const preselectedService = btn.getAttribute('data-service');
      if (serviceSelect && preselectedService) {
        serviceSelect.value = preselectedService;
      }
      if (quoteModal) {
        quoteModal.classList.add('active');
      }
    });
  });

  // 3. Manejo de Modales de Detalle de Línea de Producto
  const productModal = document.getElementById('productDetailModal');
  const productCards = document.querySelectorAll('.product-card');

  const productsData = {
    'uniformes': {
      title: 'Línea de Uniformes & Dotaciones',
      category: 'Dotaciones Empresariales e Industriales',
      image: '/artifacts/uniformes_line_1790547525555.jpg',
      desc: 'Soluciones integrales de dotación para los sectores médico, industrial, escolar y corporativo con telas de la más alta tecnología: antifluidos, dril pesado, dacrón y gabardina.',
      specs: [
        'Telas con tecnología antifluido y protección UV',
        'Costuras con doble pespunte de alta resistencia mecánica',
        'Bordados de logotipos de alta definición incluidos',
        'Cumplimiento con normativas del Ministerio del Trabajo'
      ]
    },
    'moda-accesorios': {
      title: 'Línea Moda & Accesorios',
      category: 'Joyería Fina y Tendencias',
      image: '/artifacts/moda_accesorios_1790547541896.jpg',
      desc: 'Colecciones de joyería fina artesanal con baño de oro de 18k y rodio, pulseras de tendencia, collares, cadenas y accesorios para complementar estilos sofisticados.',
      specs: [
        'Baño de oro de 18 quilates con laca protectora',
        'Diseños exclusivos inspirados en las pasarelas globales',
        'Presentación en estuche de terciopelo corporativo',
        'Garantía de durabilidad y antialérgico certificado'
      ]
    },
    'ropa-reflectiva': {
      title: 'Línea de Ropa Reflectiva & Seguridad',
      category: 'Protección Personal y Vial',
      image: '/artifacts/ropa_reflectiva_1790547560327.jpg',
      desc: 'Indumentaria de alta visibilidad para cuadrillas, ingenieros, personal vial y logístico con cintas microprismáticas y reflectivas de grado industrial.',
      specs: [
        'Cintas reflectivas 3M Scotchlite de 2 pulgadas',
        'Tejidos flúor de alta visibilidad diurna y nocturna',
        'Cumplimiento de estándares internacionales ANSI/ISEA 107',
        'Resistencia a lavado industrial y condiciones climáticas severas'
      ]
    },
    'merchandising': {
      title: 'Impresión / Sublimado & Merchandising',
      category: 'Artículos Promocionales y Marca',
      image: '/artifacts/merchandising_sublimado_1790547580797.jpg',
      desc: 'Transformamos tu marca en experiencias tangibles a través de productos promocionales personalizados: tazas cerámicas, botilitos deportivos, tulas ecológicas, termos y gorras bordadas.',
      specs: [
        'Sublimación digital fotográfica de alta resolución',
        'Serigrafía y tampografía con tintas de alta duración',
        'Precios preferenciales para compras por volumen',
        'Muestras virtuales de diseño antes de producción'
      ]
    }
  };

  productCards.forEach(card => {
    card.addEventListener('click', () => {
      const productId = card.getAttribute('data-product-id');
      const item = productsData[productId];

      if (item && productModal) {
        document.getElementById('modalProductTitle').textContent = item.title;
        document.getElementById('modalProductCategory').textContent = item.category;
        document.getElementById('modalProductDesc').textContent = item.desc;
        document.getElementById('modalProductImg').src = item.image;

        const specsContainer = document.getElementById('modalProductSpecs');
        specsContainer.innerHTML = item.specs.map(spec => `
          <div class="modal-spec-item">
            <i class="fa-solid fa-check"></i>
            <span>${spec}</span>
          </div>
        `).join('');

        productModal.classList.add('active');
      }
    });
  });

  // Cerrar cualquier modal al hacer clic en botón X o backdrop
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.classList.remove('active');
      });
      if (videoFrame) videoFrame.src = '';
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
        if (videoFrame) videoFrame.src = '';
      }
    });
  });
});
