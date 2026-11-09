const express = require('express');
const pqrs = require('../controllers/pqrsController');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

// Estado del módulo (¿hay base de datos? ¿ya existe administrador?)
router.get('/estado', pqrs.estado);

router.use(pqrs.requireDb);

// Cuentas
router.post('/auth/registro', pqrs.registro);
router.post('/auth/login', pqrs.login);
router.post('/auth/olvide', pqrs.olvideClave);
router.post('/auth/restablecer', pqrs.restablecerClave);
router.get('/auth/yo', requireAuth(), pqrs.yo);
router.patch('/auth/perfil', requireAuth(), pqrs.actualizarPerfil);
router.post('/auth/clave', requireAuth(), pqrs.cambiarClave);
router.get('/cliente/panel', requireAuth('cliente'), pqrs.panelCliente);
router.post('/admin/configurar', pqrs.configurarAdmin);

// Tickets
router.get('/tickets', requireAuth(), pqrs.listarTickets);
router.post('/tickets', requireAuth('cliente'), pqrs.crearTicket);
router.get('/tickets/:id', requireAuth(), pqrs.verTicket);
router.patch('/tickets/:id/logistica', requireAuth(), pqrs.actualizarLogistica);
router.post('/tickets/:id/respuestas', requireAuth(), pqrs.responder);
router.patch('/tickets/:id/estado', requireAuth('admin'), pqrs.cambiarEstado);
router.get('/tickets/:id/adjuntos/:adjuntoId', requireAuth(), pqrs.verAdjunto);

// Panel del administrador
router.get('/admin/panel', requireAuth('admin'), pqrs.panelAdmin);
router.get('/admin/resumen', requireAuth('admin'), pqrs.resumen);
router.get('/admin/reporte', requireAuth('admin'), pqrs.reporte);
router.get('/admin/exportar', requireAuth('admin'), pqrs.exportar);

module.exports = router;
