/**
 * main.js - Orquestador Principal B&F
 * Proyecto de Grado - Confecciones, Dotaciones, Joyería & Merchandising
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 Sistema Web B&F Textil inicializado');

  // Verificar estado del backend de manera silenciosa
  fetch('/api/health')
    .then(res => res.json())
    .then(data => {
      console.log('✅ Conexión con Backend API establecida:', data.project);
    })
    .catch(err => {
      console.log('ℹ️ Operando en modo frontend desacoplado / autónomo');
    });

  // Animación de aparición suave para tarjetas al hacer scroll (Intersection Observer)
  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.product-card, .service-card, .news-card, .client-logo-item').forEach(el => {
    revealObserver.observe(el);
  });
});
