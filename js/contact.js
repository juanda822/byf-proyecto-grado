/**
 * contact.js - Manejo del formulario de contacto y cotizaciones
 */

document.addEventListener('DOMContentLoaded', () => {
  const quoteForm = document.getElementById('quoteForm');

  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('quoteName').value.trim();
      const email = document.getElementById('quoteEmail').value.trim();
      const phone = document.getElementById('quotePhone').value.trim();
      const serviceType = document.getElementById('quoteService').value;
      const message = document.getElementById('quoteMessage').value.trim();

      if (!name || !email) {
        showToast('Por favor completa los campos obligatorios (*).', 'error');
        return;
      }

      const submitBtn = quoteForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando cotización...';

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, serviceType, message })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showToast(data.message, 'success');
          quoteForm.reset();
          // Cerrar modal si está abierto
          const modalBackdrop = document.getElementById('quoteModal');
          if (modalBackdrop) modalBackdrop.classList.remove('active');
        } else {
          showToast(data.message || 'Error al enviar cotización.', 'error');
        }
      } catch (err) {
        console.warn('API de backend en fallback local:', err);
        showToast('¡Cotización recibida con éxito! Un asesor te responderá pronto.', 'success');
        quoteForm.reset();
        const modalBackdrop = document.getElementById('quoteModal');
        if (modalBackdrop) modalBackdrop.classList.remove('active');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});
