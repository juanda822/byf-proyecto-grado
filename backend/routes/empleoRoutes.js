const express = require('express');
const empleo = require('../controllers/empleoController');
const { requireAuth } = require('../utils/auth');
const { requireDb, rateLimit } = require('../utils/http');

const router = express.Router();
router.use(requireDb);

// Público: página Trabaja con nosotros
router.get('/cargos', empleo.cargosActivos);
router.post('/postulaciones',
  rateLimit(5, 60 * 60 * 1000, 'Ya recibimos varias postulaciones desde esta conexión. Inténtalo más tarde.'),
  empleo.postular);

// Administrador
const admin = requireAuth('admin');
router.get('/admin/hojas-vida', admin, empleo.listar);
router.get('/admin/hojas-vida/:id', admin, empleo.ver);
router.patch('/admin/hojas-vida/:id', admin, empleo.actualizar);
router.delete('/admin/hojas-vida/:id', admin, empleo.eliminar);
router.get('/admin/hojas-vida/:id/archivo', admin, empleo.descargar);
router.get('/admin/cargos', admin, empleo.cargosTodos);
router.post('/admin/cargos', admin, empleo.crearCargo);
router.patch('/admin/cargos', admin, empleo.todosCargos);
router.patch('/admin/cargos/:id', admin, empleo.actualizarCargo);

module.exports = router;
