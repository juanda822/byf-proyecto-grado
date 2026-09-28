const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'contacts.json');

const sendContactMessage = (req, res) => {
  try {
    const { name, email, phone, company, serviceType, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa tu nombre completo.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa tu correo electrónico.'
      });
    }

    let contacts = [];
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      contacts = rawData ? JSON.parse(rawData) : [];
    }

    const newContact = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : 'No especificado',
      company: company ? company.trim() : 'Particular',
      serviceType: serviceType || 'Cotización General',
      message: message ? message.trim() : '',
      createdAt: new Date().toISOString(),
      status: 'Pendiente'
    };

    contacts.push(newContact);
    fs.writeFileSync(dataPath, JSON.stringify(contacts, null, 2), 'utf-8');

    return res.status(201).json({
      success: true,
      message: '¡Tu mensaje ha sido enviado exitosamente! Un asesor de B&F te contactará pronto.',
      data: {
        id: newContact.id,
        name: newContact.name
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje de contacto.',
      error: error.message
    });
  }
};

const getContacts = (req, res) => {
  try {
    let contacts = [];
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      contacts = rawData ? JSON.parse(rawData) : [];
    }
    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar mensajes de contacto',
      error: error.message
    });
  }
};

module.exports = {
  sendContactMessage,
  getContacts
};
