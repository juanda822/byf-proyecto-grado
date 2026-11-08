const express = require('express');
const contenido = require('../controllers/contenidoController');
const { requireAuth } = require('../utils/auth');
const { requireDb } = require('../utils/http');

const router = express.Router();
router.use(requireDb);

// Público
router.get('/textos', contenido.textos);
router.get('/noticias', contenido.noticiasPublicas);
router.get('/noticias/:id/imagen', contenido.imagenNoticia);

// Administrador
const admin = requireAuth('admin');
router.put('/admin/textos', admin, contenido.guardarTextos);
router.get('/admin/noticias', admin, contenido.noticiasTodas);
router.post('/admin/noticias', admin, contenido.crearNoticia);
router.put('/admin/noticias/:id', admin, contenido.actualizarNoticia);
router.patch('/admin/noticias/:id', admin, contenido.actualizarNoticia);
router.delete('/admin/noticias/:id', admin, contenido.eliminarNoticia);

module.exports = router;
