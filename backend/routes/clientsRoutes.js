const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'clients.json');

router.get('/', (req, res) => {
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const clients = JSON.parse(rawData);
    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al consultar clientes corporativos',
      error: error.message
    });
  }
});

module.exports = router;
