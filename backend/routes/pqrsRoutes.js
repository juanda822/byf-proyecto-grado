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
router.get('/auth/yo', requireAuth(), pqrs.yo);
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
router.get('/admin/resumen', requireAuth('admin'), pqrs.resumen);

module.exports = router;
