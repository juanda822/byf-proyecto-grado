/**
 * B&F REFLECTIVE - Lógica Interactiva y Dinámica
 * Maneja la interacción de navegación, descarga de catálogo PDF,
 * galería fotográfica y formulario de cotización.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Manejo del formulario "Haz tu Pedido"
  const orderForm = document.getElementById('refOrderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('refNombre')?.value || '';
      const email = document.getElementById('refEmail')?.value || '';
      const telefono = document.getElementById('refTelefono')?.value || '';
      const producto = document.getElementById('refProducto')?.value || '';
      const cantidad = document.getElementById('refCantidad')?.value || '1';

      if (!nombre || !email || !telefono) {
        alert('Por favor completa los campos principales para procesar tu solicitud.');
        return;
      }

      // Generar mensaje para WhatsApp directo
      const msg = encodeURIComponent(
        `¡Hola B&F Reflective! Mi nombre es ${nombre}. Deseo cotizar:\n` +
        `- Producto: ${producto}\n` +
        `- Cantidad estimada: ${cantidad}\n` +
        `- Contacto: ${telefono} | ${email}`
      );

      const whatsappUrl = `https://wa.me/573175721842?text=${msg}`;
      
      // Mostrar confirmación
      const submitBtn = orderForm.querySelector('.ref-btn-submit-order');
      if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡SOLICITUD ENVIADA!';
        submitBtn.style.background = '#25d366';
        submitBtn.style.color = '#ffffff';

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
          submitBtn.style.color = '';
          orderForm.reset();
          window.open(whatsappUrl, '_blank');
        }, 1200);
      }
    });
  }

  // 2. Notificación al descargar el catálogo PDF
  const pdfDownloadBtns = document.querySelectorAll('.ref-btn-download-pdf, .ref-cat-btn, #btnDescargaHero');
  pdfDownloadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Descarga de Catálogo Técnico Reflectivo iniciada.');
    });
  });

  // 3. Simulación interactiva de likes en el mockup de TikTok
  const tiktokLikeBtn = document.getElementById('tiktokLikeBtn');
  const tiktokLikeCount = document.getElementById('tiktokLikeCount');
  if (tiktokLikeBtn && tiktokLikeCount) {
    let liked = false;
    tiktokLikeBtn.addEventListener('click', () => {
      liked = !liked;
      const icon = tiktokLikeBtn.querySelector('i');
      if (liked) {
        icon.style.color = '#fe2c55';
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        tiktokLikeCount.textContent = '14.3K';
      } else {
        icon.style.color = '#ffffff';
        tiktokLikeCount.textContent = '14.2K';
      }
    });
  }
});
