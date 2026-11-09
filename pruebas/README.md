# Pruebas de las funcionalidades nuevas (CP-29 a CP-42)

Ejecutan las rutas y controladores reales de `backend/` con una base de datos SQLite en memoria
(en lugar de MySQL) y con los correos interceptados (no se envía ningún mensaje real).
No necesitan instalar dependencias ni conectarse a Railway.

```bash
node --no-warnings pruebas/pruebas-funcionalidades-nuevas.js
```

Requiere Node.js 22.5 o superior (usa el módulo `node:sqlite`).
