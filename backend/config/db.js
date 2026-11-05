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
