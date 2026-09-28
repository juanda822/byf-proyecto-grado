const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'subscribers.json');

const subscribe = (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa un correo electrónico válido.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'El formato del correo electrónico no es válido.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let subscribers = [];

    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      subscribers = rawData ? JSON.parse(rawData) : [];
    }

    const alreadySubscribed = subscribers.some(sub => sub.email === cleanEmail);
    if (alreadySubscribed) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: '¡Ya estás suscrito a nuestro boletín B&F! Te mantendremos informado de novedades.'
      });
    }

    const newSubscriber = {
      id: Date.now(),
      email: cleanEmail,
      createdAt: new Date().toISOString()
    };

    subscribers.push(newSubscriber);
    fs.writeFileSync(dataPath, JSON.stringify(subscribers, null, 2), 'utf-8');

    return res.status(201).json({
      success: true,
      message: '¡Gracias por suscribirte al boletín de B&F! Pronto recibirás ofertas y novedades.',
      data: {
        id: newSubscriber.id,
        email: newSubscriber.email
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al procesar la suscripción.',
      error: error.message
    });
  }
};

const getSubscribers = (req, res) => {
  try {
    let subscribers = [];
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      subscribers = rawData ? JSON.parse(rawData) : [];
    }
    return res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar suscriptores',
      error: error.message
    });
  }
};

module.exports = {
  subscribe,
  getSubscribers
};
