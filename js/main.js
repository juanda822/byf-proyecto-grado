/**
 * main.js - Orquestador Principal B&F
 * Proyecto de Grado - Confecciones, Dotaciones, Joyería & Merchandising
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 Sistema Web B&F Textil inicializado');

  // Adaptador inteligente de rutas para compatibilidad tanto en servidor Node.js como en doble clic local (file://)
  if (window.location.protocol === 'file:') {
    const brainBasePath = 'C:/Users/JUAN/.gemini/antigravity-ide/brain/9c1ec6dd-3cfb-47fa-bd15-06db260d5467/';
    document.querySelectorAll('img').forEach(img => {
      const currentSrc = img.getAttribute('src');
      if (currentSrc && currentSrc.startsWith('/artifacts/')) {
        img.src = brainBasePath + currentSrc.replace('/artifacts/', '');
      }
    });

    const hero = document.querySelector('.hero-section');
    if (hero) {
      hero.style.backgroundImage = `radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(248, 250, 252, 0.95) 100%), url('${brainBasePath}hero_silk_background_1790547505433.jpg')`;
    }
  }

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
