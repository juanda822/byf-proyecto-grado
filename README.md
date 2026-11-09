# B&F — Plataforma web y API

Sitio de Confecciones, Dotaciones, Moda y Merchandising. El frontend usa HTML, CSS y JavaScript; la API usa Node.js y Express y persiste datos en JSON.

## Estructura

```text
frontend/
  index.html                 Portal principal
  uniformes.html             Línea de uniformes
  reflectivo.html            Línea reflectiva
  printbordados.html         Línea Print & Bordados
  pqrs.html                  Inicia sesión: paneles del cliente y del administrador
  trabaja-con-nosotros.html  Formulario de hojas de vida
  politica-privacidad.html   Política de tratamiento de datos (Ley 1581)
  css/00-global/ … 14-reflectivo/  Estilos por sección
  js/                        Interacciones y formularios
  assets/                    Imágenes, logos y catálogos únicos
backend/
  server.js                  Único servidor de web y API
  routes/                    Rutas REST
  controllers/               Lógica de la API
  data/                      Datos y registros JSON
  config/db.js               Conexión a MySQL (módulo PQRS)
  database/schema.sql        Tablas MySQL del módulo PQRS
  uploads/pqrs/              Fotos de las PQRS (se crea sola, no va a Git)
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

| GET | `/api/pqrs/estado` | ¿Hay base de datos? ¿Ya existe administrador? |
| POST | `/api/pqrs/auth/registro` | Registro de clientes |
| POST | `/api/pqrs/auth/login` | Ingreso de clientes y administrador |
| POST | `/api/pqrs/auth/olvide` | Envía al correo registrado un enlace para crear una contraseña nueva |
| POST | `/api/pqrs/auth/restablecer` | Guarda la contraseña nueva con el código del enlace e inicia sesión |
| POST | `/api/pqrs/admin/configurar` | Crea la cuenta del administrador (solo una vez) |
| GET, POST | `/api/pqrs/tickets` | Listar tickets (el cliente ve los suyos, el admin todos) o radicar uno |
| GET | `/api/pqrs/tickets/:id` | Detalle con fotos y respuestas |
| PATCH | `/api/pqrs/tickets/:id/logistica` | Dirección y especificaciones de recogida y entrega |
| POST | `/api/pqrs/tickets/:id/respuestas` | Responder (admin) o agregar mensaje (cliente) |
| PATCH | `/api/pqrs/tickets/:id/estado` | Cambiar estado (admin) |
| GET | `/api/pqrs/admin/resumen` | Conteo por estado (admin) |
| GET | `/api/pqrs/admin/reporte` | Reporte por estado, tipo, mes, motivo, prenda y cliente (admin) |
| GET | `/api/pqrs/admin/exportar` | Descarga de las PQRS en CSV para Excel (admin) |

Las rutas inexistentes responden 404; no devuelven HTML como si fuera una imagen o un script.

## Trabaja con nosotros

La franja dorada de la página principal lleva a `trabaja-con-nosotros.html`, donde cualquier persona envía su hoja de vida (PDF o Word, máximo 5 MB) para uno de los cargos activos, con autorización de tratamiento de datos. Cada postulación genera un código `HV-2026-00001`, llega al panel del administrador (*Hojas de vida*) y por correo, con la hoja de vida adjunta. Desde la pestaña *Cargos* el administrador activa solo los cargos que necesita; si todos están inactivos, el formulario se cierra.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/empleo/cargos` | Cargos activos |
| POST | `/api/empleo/postulaciones` | Enviar hoja de vida (máximo 5 por hora por conexión) |
| GET, PATCH, DELETE | `/api/empleo/admin/hojas-vida[/:id]` | Listar, cambiar estado y notas, eliminar (admin) |
| GET | `/api/empleo/admin/hojas-vida/:id/archivo` | Descargar la hoja de vida (admin) |
| GET, POST, PATCH | `/api/empleo/admin/cargos[/:id]` | Cargos: listar, crear, activar o desactivar (admin) |
| GET, PUT | `/api/contenido/textos`, `/api/contenido/admin/textos` | Textos de «Trabaja con nosotros» |
| GET, POST, PUT, PATCH, DELETE | `/api/contenido/noticias`, `/api/contenido/admin/noticias[/:id]` | Noticias de la página principal |

## Módulo PQRS y garantías (MySQL)

El botón dorado **Inicia sesión** (arriba a la derecha en todas las páginas) abre `pqrs.html`. Después de ingresar, el administrador ve su panel (Gestionar PQRS, Gestionar garantías, Hojas de vida y Administrar contenido) y el cliente el suyo (Crear PQRS, Mis solicitudes, Solicitar garantía y Mi perfil):

- **Cliente:** se registra, ingresa y radica su petición, queja o reclamo: cliente, número de pedido, tipo (lista desplegable), asunto (por ejemplo, Garantía), prenda y talla si aplican, descripción del motivo, fotos del prelavado y fotos de la parte defectuosa. Al enviar se genera un ticket (`PQR-2026-00001`) y pasa al paso 2, donde puede anexar dirección, ciudad, teléfono y especificaciones de recogida y entrega (o hacerlo después). En *Mis solicitudes* ve el estado, las respuestas y puede escribir mensajes.
- **Administrador:** ve todas las PQRS con contadores por estado, buscador y filtros; abre cada ticket con sus fotos y datos de recogida, responde al cliente y cambia el estado (Radicado → En revisión → Respondido → Cerrado).

- **Reporte:** en el panel del administrador, la pestaña *Reporte* muestra totales, tiempo promedio de primera respuesta y gráficas por estado, tipo, mes, motivo, prenda y cliente, con filtro de fechas. Se puede descargar en Excel (CSV) o imprimir / guardar como PDF.
- **¿Olvidaste tu contraseña?:** en *Ingresar*, el cliente o el administrador escribe su correo registrado y recibe un enlace (`pqrs.html#restablecer=…`) para crear una contraseña nueva. El enlace vence en 1 hora, sirve una sola vez y pedir otro anula el anterior; en la base de datos solo se guarda su hash. La respuesta es la misma exista o no la cuenta, y se limita a 8 solicitudes cada 15 minutos por conexión. Requiere `BREVO_API_KEY`, `MAIL_FROM` y `SITE_URL`.
- **Avisos por correo (opcional):** el cliente recibe un correo al radicar, cuando el administrador responde y cuando cambia el estado; B&F recibe un aviso de cada PQRS nueva y de cada mensaje de un cliente.

### Configuración

1. Instala MySQL 8 (o MariaDB) y créale un usuario, o usa `root`.
2. Copia `backend/.env.example` como `backend/.env` y completa `DB_USER`, `DB_PASSWORD` y un `AUTH_SECRET` largo.
3. `cd backend && npm install --package-lock=false && npm start`. Al iniciar, el servidor crea la base `byf_pqrs` y sus tablas (`database/schema.sql`). Si MySQL no está disponible, el resto del sitio sigue funcionando y la página PQRS muestra un aviso.
4. Crea la cuenta del administrador de una de estas dos formas:
   - En `pqrs.html`, enlace **Crear la cuenta del administrador** (solo aparece mientras no exista ninguno). Si el sitio estará en internet, define `ADMIN_SETUP_KEY` en `.env` para que se pida esa clave.
   - Desde la terminal: `cd backend && npm run crear-admin` (también sirve para restablecer la contraseña).

Para activar los correos, crea una cuenta gratuita en [Brevo](https://www.brevo.com), verifica un remitente (*Senders*) y genera una clave de API (*SMTP & API → API Keys*). Luego define en `.env` (o en las variables de Railway) `BREVO_API_KEY`, `MAIL_FROM` (el remitente verificado), `ADMIN_NOTIFY_EMAIL` y `SITE_URL`. Se usa la API de Brevo y no SMTP porque Railway bloquea el correo por SMTP. Sin esas variables el sitio funciona igual, solo que sin avisos.

Tablas nuevas: `cargos`, `hojas_vida`, `contenido` y `noticias`. La columna `tickets.categoria` separa las PQRS de las garantías; las bases creadas antes se actualizan solas al iniciar el servidor.

Tablas: `usuarios` (clientes y administradores, contraseñas con scrypt), `tickets`, `ticket_adjuntos` (fotos guardadas en `backend/uploads/pqrs/`, fuera de la carpeta pública y servidas solo a su dueño y al administrador) y `ticket_respuestas`. Las fotos se reducen en el navegador a 1600 px antes de enviarse; se aceptan JPG, PNG y WEBP, máximo 6 por sección.

## Recursos pendientes y herramientas históricas

El repositorio original no incluye seis imágenes referenciadas en `/artifacts/` ni `frontend/assets/VIDEO BYF.mp4`. Las imágenes opcionales se pueden colocar en `frontend/assets/artifacts/` con los nombres usados en `index.html`; el servidor las publica en `/artifacts/`. No se depende de carpetas privadas de Windows. Fuentes, iconos, mapas y videos de YouTube necesitan acceso a sus proveedores externos.

`tools/legacy-assets/` conserva scripts PowerShell históricos con rutas de la máquina original. No forman parte del arranque ni son herramientas portables: revisa sus rutas antes de utilizarlos.

Se consolidó el diseño de Reflectivo que estaba en la raíz (menú HOME/ABOUT y logo central), junto con su CSS correspondiente. Para Uniformes se conservan el HTML de la raíz y los recursos que ya servía `frontend/`, incluido su catálogo propio.
