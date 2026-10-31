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

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 Servidor B&F Backend ejecutándose exitosamente`);
  console.log(`🌐 URL Local: http://localhost:${PORT}`);
  console.log(`📁 Frontend servido desde: ${frontendPath}`);
  console.log(`📋 API endpoints activos en: http://localhost:${PORT}/api/health`);
  console.log('========================================================');
});
