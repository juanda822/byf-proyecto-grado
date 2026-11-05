// Variables de entorno (backend/.env) — requiere Node 20.12+ / 22
try {
  process.loadEnvFile(require('path').join(__dirname, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') console.warn('No se pudo leer backend/.env:', error.message);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const productsRoutes = require('./routes/productsRoutes');
const servicesRoutes = require('./routes/servicesRoutes');
const blogRoutes = require('./routes/blogRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const contactRoutes = require('./routes/contactRoutes');
const clientsRoutes = require('./routes/clientsRoutes');
const pqrsRoutes = require('./routes/pqrsRoutes');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
// Las PQRS llevan fotos en base64: límite de cuerpo mayor solo para esa ruta.
app.use('/api/pqrs', express.json({ limit: '60mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend de manera estática
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Recursos opcionales no incluidos en Git, dentro del frontend.
app.use('/artifacts', express.static(path.join(frontendPath, 'assets', 'artifacts')));

// Rutas de API REST
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/pqrs', pqrsRoutes);

// Endpoint de estado y resumen general para el proyecto de grado
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    project: 'B&F Confecciones, Dotaciones, Moda & Merchandising',
    version: '1.0.0',
    description: 'Servidor Backend API REST modular activo',
    endpoints: [
      '/api/products',
      '/api/services',
      '/api/blog',
      '/api/newsletter',
      '/api/contact',
      '/api/clients',
      '/api/pqrs',
      '/api/stats'
    ]
  });
});

// Resumen de estadísticas (suscriptores y contactos recibidos)
app.get('/api/stats', (req, res) => {
  try {
    const subsPath = path.join(__dirname, 'data', 'subscribers.json');
    const contactsPath = path.join(__dirname, 'data', 'contacts.json');

    const subs = fs.existsSync(subsPath) ? JSON.parse(fs.readFileSync(subsPath, 'utf-8')) : [];
    const contacts = fs.existsSync(contactsPath) ? JSON.parse(fs.readFileSync(contactsPath, 'utf-8')) : [];

    res.json({
      success: true,
      stats: {
        totalSubscribers: subs.length,
        totalContacts: contacts.length,
        latestSubscribers: subs.slice(-5),
        latestContacts: contacts.slice(-5)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Las páginas HTML se sirven desde frontend/. Los recursos ausentes deben dar 404.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Recurso no encontrado.' });
});

// Errores de cuerpo (JSON mal formado o demasiado grande)
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Las fotos pesan demasiado. Adjunta menos fotos o de menor tamaño.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Solicitud con formato inválido.' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Ocurrió un error en el servidor.' });
});

// Conexión a MySQL para el módulo PQRS (el resto del sitio funciona sin ella)
db.init();

// Iniciar servidor
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 Servidor B&F Backend ejecutándose exitosamente`);
  console.log(`🌐 URL Local: http://localhost:${PORT}`);
  console.log(`📁 Frontend servido desde: ${frontendPath}`);
  console.log(`📋 API endpoints activos en: http://localhost:${PORT}/api/health`);
  console.log(`🎫 PQRS y garantías: http://localhost:${PORT}/pqrs.html`);
  console.log('========================================================');
});
