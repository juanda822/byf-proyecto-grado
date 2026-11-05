/**
 * Crea (o restablece la contraseña de) una cuenta de administrador PQRS desde la terminal.
 *   cd backend
 *   npm run crear-admin
 */
const path = require('path');
const readline = require('readline/promises');

try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch { /* sin .env: se usan valores por defecto */ }

const db = require('../config/db');
const { hashPassword } = require('../utils/auth');

async function main() {
  await db.init();
  if (!db.isReady()) process.exit(1);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const nombre = (await rl.question('Nombre del administrador: ')).trim();
  const email = (await rl.question('Correo: ')).trim().toLowerCase();
  const password = await rl.question('Contraseña (mínimo 8 caracteres): ');
  rl.close();

  if (nombre.length < 3 || !email.includes('@') || password.length < 8) {
    console.error('Datos incompletos: revisa nombre, correo y contraseña.');
    process.exit(1);
  }

  const existing = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existing[0]) {
    await db.query("UPDATE usuarios SET rol = 'admin', nombre = ?, password_hash = ? WHERE id = ?",
      [nombre, hashPassword(password), existing[0].id]);
    console.log(`✅ La cuenta ${email} ahora es administrador (contraseña actualizada).`);
  } else {
    await db.query("INSERT INTO usuarios (rol, nombre, email, password_hash) VALUES ('admin', ?, ?, ?)",
      [nombre, email, hashPassword(password)]);
    console.log(`✅ Administrador ${email} creado.`);
  }
  process.exit(0);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
