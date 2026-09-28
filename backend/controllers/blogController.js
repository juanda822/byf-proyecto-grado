const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'blog.json');

const getBlogPosts = (req, res) => {
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const posts = JSON.parse(rawData);
    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener noticias y artículos',
      error: error.message
    });
  }
};

const getBlogPostById = (req, res) => {
  try {
    const { id } = req.params;
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const posts = JSON.parse(rawData);
    const post = posts.find(p => p.id === parseInt(id, 10));

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Artículo de blog no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al consultar la noticia',
      error: error.message
    });
  }
};

module.exports = {
  getBlogPosts,
  getBlogPostById
};
