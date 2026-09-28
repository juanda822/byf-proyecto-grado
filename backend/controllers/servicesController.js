const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'services.json');

const getServices = (req, res) => {
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const services = JSON.parse(rawData);
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener los servicios textiles',
      error: error.message
    });
  }
};

module.exports = {
  getServices
};
