const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'products.json');

const getProducts = (req, res) => {
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const products = JSON.parse(rawData);
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el catálogo de productos',
      error: error.message
    });
  }
};

const getProductById = (req, res) => {
  try {
    const { id } = req.params;
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const products = JSON.parse(rawData);
    const product = products.find(p => p.id === id || p.slug === id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Línea de producto '${id}' no encontrada`
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al buscar el producto',
      error: error.message
    });
  }
};

module.exports = {
  getProducts,
  getProductById
};
