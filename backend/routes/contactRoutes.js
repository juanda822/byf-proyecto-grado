const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

router.post('/', contactController.sendContactMessage);
router.get('/', contactController.getContacts);

module.exports = router;
