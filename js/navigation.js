/**
 * navigation.js - Control de Menú de Navegación y Scroll Suave
 * B&F Confecciones, Dotaciones & Merchandising
 */

document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileToggle = document.getElementById('mobileNavToggle');
  const navMenu = document.getElementById('navMenuList');

  // Alternar menú en dispositivos móviles
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
      }
    });
  }

  // Cerrar menú móvil al hacer clic en un enlace y marcar activo
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Remover clase activa de todos
      document.querySelectorAll('.nav-menu-item').forEach(item => item.classList.remove('active'));
      link.parentElement.classList.add('active');

      if (navMenu && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        if (mobileToggle) {
          const icon = mobileToggle.querySelector('i');
          if (icon) {
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-xmark');
          }
        }
      }
    });
  });

  // Detección de sección activa durante el scroll
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 120;
      const sectionId = section.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.parentElement.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.parentElement.classList.add('active');
          }
        });
      }
    });
  });
});
