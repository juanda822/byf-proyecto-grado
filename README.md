# 🧵 B&F Confecciones, Dotaciones, Moda & Merchandising
## 🎓 Proyecto de Grado - Plataforma Web y Backend Modular

Este proyecto ha sido desarrollado con una **arquitectura desacoplada y 100% modular organizada por subcarpetas**, permitiendo identificar, personalizar y modificar cada sección visual y lógica de manera rápida e intuitiva.

---

## 🗂️ Estructura del Proyecto Organizada por Subcarpetas

```text
byf-proyecto-grado/
│
├── 📁 backend/                        --> Servidor y API REST (Node.js + Express)
│   ├── 📄 server.js                   --> Punto de entrada del servidor Express
│   ├── 📄 package.json                --> Dependencias y scripts de ejecución
│   ├── 📁 routes/                     --> Definición de endpoints de la API
│   │   ├── productsRoutes.js          --> Rutas de catálogo y productos
│   │   ├── servicesRoutes.js          --> Rutas de servicios textiles
│   │   ├── blogRoutes.js              --> Rutas de noticias y publicaciones
│   │   ├── newsletterRoutes.js        --> Rutas para captación y suscripciones
│   │   ├── contactRoutes.js           --> Rutas para formulario de cotización
│   │   └── clientsRoutes.js           --> Rutas de marcas y clientes aliados
│   ├── 📁 controllers/                --> Lógica de negocio y procesamiento
│   │   ├── productsController.js
│   │   ├── servicesController.js
│   │   ├── blogController.js
│   │   ├── newsletterController.js
│   │   └── contactController.js
│   └── 📁 data/                       --> Base de datos JSON (Fácil de editar y persistente)
│       ├── products.json              --> Información de las 4 líneas textiles
│       ├── services.json              --> Detalle de los 4 servicios
│       ├── blog.json                  --> Artículos y noticias
│       ├── clients.json               --> Listado de marcas corporativas
│       ├── subscribers.json           --> Correos registrados en el newsletter
│       └── contacts.json              --> Mensajes y cotizaciones recibidas
│
├── 📁 frontend/                       --> Interfaz gráfica visual (HTML, CSS y JS modulares)
│   ├── 📄 index.html                  --> Estructura principal completa con comentarios
│   │
│   ├── 📁 css/                        --> 🎨 ESTILOS INDEPENDIENTES POR SUBCARPETAS
│   │   ├── 📁 00-global/              --> Variables de color, tipografía y resets
│   │   │   └── global.css
│   │   ├── 📁 01-header/              --> Barra superior, contacto rápido y menú de navegación
│   │   │   └── header.css
│   │   ├── 📁 02-hero/                --> Banner principal con textura de seda y emblema B&F
│   │   │   └── hero.css
│   │   ├── 📁 03-productos/           --> 4 tarjetas de productos (Uniformes, Moda, Reflectivo, Merch)
│   │   │   └── productos.css
│   │   ├── 📁 04-corporativo/         --> Sección "Fabricamos con Amor", video y pasión artesanal
│   │   │   └── corporativo.css
│   │   ├── 📁 05-servicios/           --> 4 servicios con insignias de diamante
│   │   │   └── servicios.css
│   │   ├── 📁 06-clientes/            --> Franja gris con logos corporativos de confianza
│   │   │   └── clientes.css
│   │   ├── 📁 07-noticias/            --> Blog corporativo y artículos de impacto
│   │   │   └── noticias.css
│   │   ├── 📁 08-newsletter/          --> Franja dorada/amarilla de captación
│   │   │   └── newsletter.css
│   │   ├── 📁 09-contacto/            --> Contacto con iconos circulares y mapa interactivo
│   │   │   └── contacto.css
│   │   ├── 📁 10-footer/              --> Pie de página oscuro y galería Instagram 3x2
│   │   │   └── footer.css
│   │   ├── 📁 11-modals/              --> Modales de video, cotización y avisos Toast
│   │   │   └── modals.css
│   │   └── 📁 12-responsive/          --> Adaptabilidad móvil y tablets
│   │       └── responsive.css
│   │
│   ├── 📁 js/                         --> ⚡ SCRIPTS MODULARES
│   │   ├── main.js                    --> Orquestador, observador de animaciones y salud del backend
│   │   ├── navigation.js              --> Menú responsivo y scroll espía de navegación activa
│   │   ├── newsletter.js              --> Validación y conexión AJAX/Fetch con /api/newsletter
│   │   ├── contact.js                 --> Envío de cotizaciones con /api/contact
│   │   └── modals.js                  --> Control de modales y visor dinámico de productos
│   │
│   └── 📁 assets/                     --> Recursos vectoriales y multimedia
│       └── 📁 logos/                  --> Logos vectoriales SVG de alta definición
│           ├── byf-logo-dark.svg      --> Logo principal para fondos claros
│           ├── byf-logo-white.svg     --> Logo blanco para fondos oscuros
│           ├── byf-hero-emblem.svg    --> Emblema de gran escala para el Banner Hero
│           ├── byf-uniformes.svg      --> Insignia B&F Uniformes
│           ├── byf-moda.svg           --> Insignia B&F Moda & Accesorios
│           ├── byf-reflectivo.svg     --> Insignia B&F Ropa Reflectiva
│           └── byf-merchandising.svg  --> Insignia B&F Merchandising
│
└── 📄 README.md                       --> Documentación y guía de uso
```

---

## 🚀 ¿Cómo Iniciar el Proyecto?

### Requisitos
- **Node.js** (v18 o superior) instalado en tu computador.

### Pasos para Ejecutar el Backend y la Web:
1. Abre tu terminal (PowerShell o CMD) en la carpeta del backend:
   ```bash
   cd "C:\Users\JUAN\.gemini\antigravity-ide\scratch\byf-proyecto-grado\backend"
   ```

2. Instala las dependencias (Express y CORS):
   ```bash
   npm install
   ```

3. Inicia el servidor:
   ```bash
   npm start
   ```

4. Abre tu navegador web favorito e ingresa a:
   👉 **`http://localhost:3000`**

*(Nota: También puedes abrir directamente el archivo `frontend/index.html` con doble clic o con la extensión Live Server de VS Code).*

---

## 📡 Endpoints del Backend API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servidor y resumen de servicios activos |
| `GET` | `/api/products` | Catálogo completo de las 4 líneas textiles |
| `GET` | `/api/products/:id` | Ficha técnica de un producto específico |
| `GET` | `/api/services` | Lista de servicios (Diseño, Confección, etc.) |
| `GET` | `/api/blog` | Noticias y artículos del blog |
| `GET` | `/api/clients` | Listado de marcas corporativas aliadas |
| `POST` | `/api/newsletter` | Registra un correo en `subscribers.json` |
| `POST` | `/api/contact` | Guarda una cotización o consulta en `contacts.json` |
| `GET` | `/api/stats` | Estadísticas para el panel de administración |

---

## 🛠️ ¿Cómo Realizar Cambios Fácilmente?

- **Cambiar colores o fuentes globales**: Abre `frontend/css/00-global/global.css` y modifica las variables `:root`.
- **Modificar textos o precios de productos**: Abre `backend/data/products.json`.
- **Editar el diseño de una sección en particular**: Ve a la subcarpeta numerada correspondiente en `frontend/css/` (por ejemplo, `03-productos/productos.css`).
- **Ver las cotizaciones enviadas por clientes**: Abre `backend/data/contacts.json`.
- **Ver la lista de suscriptores al boletín**: Abre `backend/data/subscribers.json`.
