/**
 * Conexión a MySQL para el módulo PQRS.
 * Lee la configuración de variables de entorno (archivo backend/.env).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'byf_pqrs'
};

let pool = null;
let ready = false;
let lastError = null;

/** Sentencias CREATE TABLE de schema.sql (sin CREATE DATABASE ni USE). */
function schemaStatements() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => /^CREATE TABLE/i.test(s));
}

/** Crea la base de datos y las tablas si no existen. */
async function init() {
  try {
    const bootstrap = await mysql.createConnection({
      host: config.host, port: config.port, user: config.user, password: config.password
    });
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await bootstrap.end();

    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      dateStrings: false
    });
    for (const statement of schemaStatements()) {
      await pool.query(statement);
    }
    await migrate();
    ready = true;
    lastError = null;
    console.log(`🗄️  MySQL conectado: ${config.user}@${config.host}:${config.port}/${config.database}`);
  } catch (error) {
    ready = false;
    lastError = error;
    console.error('⚠️  No se pudo conectar a MySQL. El módulo PQRS no estará disponible.');
    console.error(`   ${error.code || ''} ${error.message}`);
    console.error('   Revisa DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en backend/.env');
  }
}

/** Cambios para bases de datos creadas con una versión anterior. */
async function columnExists(table, column) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return Number(rows[0].n) > 0;
}

async function migrate() {
  if (!(await columnExists('tickets', 'categoria'))) {
    await pool.query("ALTER TABLE tickets ADD COLUMN categoria ENUM('pqrs','garantia') NOT NULL DEFAULT 'pqrs' AFTER usuario_id, ADD KEY idx_tickets_categoria (categoria)");
    // Las solicitudes antiguas con asunto de garantía pasan a la nueva categoría
    await pool.query("UPDATE tickets SET categoria = 'garantia' WHERE asunto LIKE 'garant%'");
    console.log('🗄️  Migración: columna tickets.categoria agregada');
  }
  const [[col]] = await pool.query(
    "SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'numero_pedido'"
  );
  if (col && col.n === 'NO') {
    await pool.query('ALTER TABLE tickets MODIFY numero_pedido VARCHAR(40) NULL');
  }
  await seed();
}

const CARGOS_INICIALES = [
  ['Auxiliar contable', 'Administrativa'],
  ['Diseñador(a) textil y de modas', 'Diseño'],
  ['Asesor(a) comercial y de servicio al cliente', 'Comercial'],
  ['Operario(a) de bordado', 'Producción'],
  ['Operario(a) de confección', 'Producción'],
  ['Operario(a) de planchado', 'Producción'],
  ['Operario(a) de terminación y empaque', 'Producción'],
  ['Supervisor(a) de producción', 'Producción'],
  ['Operario(a) de corte textil', 'Producción'],
  ['Operario(a) de estampación y termofijado', 'Producción'],
  ['Operario(a) de impresión DTF', 'Producción'],
  ['Auxiliar de logística', 'Logística'],
  ['Auxiliar de bodega e inventarios', 'Logística'],
  ['Conductor(a) de reparto', 'Logística']
];

const CONTENIDO_INICIAL = {
  trabaja_titulo: 'Trabaja con nosotros',
  trabaja_texto: 'En Diseños ByF buscamos personas comprometidas, responsables y con ganas de crecer. Si quieres hacer parte de nuestro equipo, déjanos tu hoja de vida.',
  trabaja_intro: 'Completa el formulario y envíanos tu hoja de vida para futuras oportunidades laborales.'
};

const NOTICIAS_INICIALES = [
  ['Un reconocimiento a quienes crean con sus manos.', 'En B&F celebramos el Día del Confeccionista reconociendo y agradeciendo la dedicación, el esfuerzo y el talento de quienes hacen posible cada una de nuestras prendas. Como muestra de gratitud, compartimos un pequeño detalle con nuestros confeccionistas, porque su trabajo es parte fundamental de lo que somos.', '2026-10-14', 'assets/noticiasbyf/confeccionista.png'],
  ['Capacitación de Sostenibilidad', 'Las capacitaciones permiten compartir conocimientos y trabajar en equipo para generar cambios que aporten de manera positiva a nuestra sociedad.', '2026-10-22', 'assets/noticiasbyf/capacitacion.png']
];

/** Datos iniciales: solo se insertan si la tabla está vacía. */
async function seed() {
  const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM cargos');
  if (Number(c.n) === 0) {
    await pool.query('INSERT INTO cargos (nombre, area, orden) VALUES ?', [CARGOS_INICIALES.map(([n, a], i) => [n, a, i + 1])]);
  }
  for (const [clave, valor] of Object.entries(CONTENIDO_INICIAL)) {
    await pool.query('INSERT IGNORE INTO contenido (clave, valor) VALUES (?, ?)', [clave, valor]);
  }
  const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM noticias');
  if (Number(n.n) === 0) {
    await pool.query('INSERT INTO noticias (titulo, resumen, fecha, imagen) VALUES ?', [NOTICIAS_INICIALES]);
  }
}

function isReady() {
  return ready;
}

async function query(sql, params = []) {
  if (!ready) throw Object.assign(new Error('Base de datos no disponible'), { status: 503 });
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Ejecuta varias operaciones dentro de una transacción. */
async function transaction(work) {
  if (!ready) throw Object.assign(new Error('Base de datos no disponible'), { status: 503 });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: async (sql, params = []) => (await conn.query(sql, params))[0]
    };
    const result = await work(tx);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { init, isReady, query, transaction, getLastError: () => lastError };
