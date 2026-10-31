# B&F — Plataforma web y API

Sitio de Confecciones, Dotaciones, Moda y Merchandising. El frontend usa HTML, CSS y JavaScript; la API usa Node.js y Express y persiste datos en JSON.

## Estructura

```text
frontend/
  index.html                 Portal principal
  uniformes.html             Línea de uniformes
  reflectivo.html            Línea reflectiva
  css/00-global/ … 14-reflectivo/  Estilos por sección
  js/                        Interacciones y formularios
  assets/                    Imágenes, logos y catálogos únicos
backend/
  server.js                  Único servidor de web y API
  routes/                    Rutas REST
  controllers/               Lógica de la API
  data/                      Datos y registros JSON
  package.json               Dependencias y comandos
scripts/
  smoke.js                   Comprobación HTTP sin escribir datos
tools/legacy-assets/        Utilidades históricas de preparación de imágenes
```

Todas las páginas y recursos públicos viven en `frontend/`. Edita únicamente esa versión: no hay que copiar archivos a la raíz ni crear enlaces simbólicos. Los estilos de Uniformes y Reflectivo están en `frontend/css/13-uniformes/uniformes.css` y `frontend/css/14-reflectivo/reflectivo.css`, respectivamente.

## Desarrollo

Requisitos: Node.js 18 o superior y npm.

```bash
cd backend
npm install --package-lock=false
npm run dev
```

El servidor usa el puerto 3000 por defecto; puede cambiarse con `PORT`. `npm start` ejecuta el servidor sin recarga automática. Abre la ruta `/` para el portal, `/uniformes.html` y `/reflectivo.html` para las líneas. No se requiere base de datos externa ni claves de acceso.

El repositorio todavía no fija versiones mediante lockfile: una nueva instalación puede resolver versiones compatibles diferentes. `node_modules/` se ignora en Git.

Con el servidor iniciado, desde la raíz:

```bash
node scripts/smoke.js
```

La comprobación valida páginas, recursos CSS/JS, catálogos, API y rechazo de formularios vacíos. No agrega suscriptores ni contactos. Los formularios válidos escriben en `backend/data/`; conserva esos datos antes de probar envíos reales.

## API

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor |
| GET | `/api/products` | Catálogo de productos |
| GET | `/api/products/:id` | Producto específico |
| GET | `/api/services` | Servicios |
| GET | `/api/blog` | Noticias |
| GET | `/api/clients` | Clientes |
| GET, POST | `/api/newsletter` | Consultar o agregar suscriptores |
| GET, POST | `/api/contact` | Consultar o guardar mensajes |
| GET | `/api/stats` | Resumen de registros |

Las rutas inexistentes responden 404; no devuelven HTML como si fuera una imagen o un script.

## Recursos pendientes y herramientas históricas

El repositorio original no incluye seis imágenes referenciadas en `/artifacts/` ni `frontend/assets/VIDEO BYF.mp4`. Las imágenes opcionales se pueden colocar en `frontend/assets/artifacts/` con los nombres usados en `index.html`; el servidor las publica en `/artifacts/`. No se depende de carpetas privadas de Windows. Fuentes, iconos, mapas y videos de YouTube necesitan acceso a sus proveedores externos.

`tools/legacy-assets/` conserva scripts PowerShell históricos con rutas de la máquina original. No forman parte del arranque ni son herramientas portables: revisa sus rutas antes de utilizarlos.

Se consolidó el diseño de Reflectivo que estaba en la raíz (menú HOME/ABOUT y logo central), junto con su CSS correspondiente. Para Uniformes se conservan el HTML de la raíz y los recursos que ya servía `frontend/`, incluido su catálogo propio.
