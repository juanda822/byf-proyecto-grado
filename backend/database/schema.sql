-- ==========================================================================
-- B&F · Módulo PQRS (Peticiones, Quejas y Reclamos) y garantías
-- Base de datos MySQL 8 (o MariaDB 10.5+)
--
-- El servidor crea estas tablas automáticamente al iniciar si no existen.
-- También puedes ejecutar este archivo manualmente:
--   mysql -u root -p < backend/database/schema.sql
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS byf_pqrs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE byf_pqrs;

-- Cuentas de clientes y administradores
CREATE TABLE IF NOT EXISTS usuarios (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rol            ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
  nombre         VARCHAR(150) NOT NULL,
  documento      VARCHAR(40)  NULL,
  email          VARCHAR(190) NOT NULL,
  telefono       VARCHAR(40)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada PQR es un ticket
CREATE TABLE IF NOT EXISTS tickets (
  id                         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo                     VARCHAR(20)  NULL,
  usuario_id                 INT UNSIGNED NOT NULL,
  categoria                  ENUM('pqrs', 'garantia') NOT NULL DEFAULT 'pqrs',
  cliente                    VARCHAR(150) NOT NULL,
  numero_pedido              VARCHAR(40)  NULL,
  tipo                       ENUM('peticion', 'queja', 'reclamo') NOT NULL,
  asunto                     VARCHAR(150) NOT NULL,
  prenda                     VARCHAR(100) NULL,
  talla                      VARCHAR(30)  NULL,
  descripcion                TEXT         NOT NULL,
  estado                     ENUM('radicado', 'en_revision', 'respondido', 'cerrado') NOT NULL DEFAULT 'radicado',
  direccion                  VARCHAR(255) NULL,
  ciudad                     VARCHAR(100) NULL,
  telefono_contacto          VARCHAR(40)  NULL,
  especificaciones_recogida  TEXT         NULL,
  especificaciones_entrega   TEXT         NULL,
  creado_en                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_codigo (codigo),
  KEY idx_tickets_usuario (usuario_id),
  KEY idx_tickets_estado (estado),
  KEY idx_tickets_categoria (categoria),
  CONSTRAINT fk_tickets_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos del prelavado y de la parte defectuosa
CREATE TABLE IF NOT EXISTS ticket_adjuntos (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id        INT UNSIGNED NOT NULL,
  categoria        ENUM('prelavado', 'defecto') NOT NULL,
  nombre_original  VARCHAR(255) NOT NULL,
  archivo          VARCHAR(255) NOT NULL,
  mime             VARCHAR(50)  NOT NULL,
  tamano           INT UNSIGNED NOT NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_adjuntos_ticket (ticket_id),
  CONSTRAINT fk_adjuntos_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversación del ticket: respuestas del administrador y mensajes del cliente
CREATE TABLE IF NOT EXISTS ticket_respuestas (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id   INT UNSIGNED NOT NULL,
  usuario_id  INT UNSIGNED NOT NULL,
  autor_rol   ENUM('cliente', 'admin') NOT NULL,
  mensaje     TEXT NOT NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_respuestas_ticket (ticket_id),
  CONSTRAINT fk_respuestas_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_respuestas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================================
-- Trabaja con nosotros: cargos, hojas de vida, contenido editable y noticias
-- ==========================================================================

-- Cargos que la empresa ofrece; el administrador los activa o desactiva
CREATE TABLE IF NOT EXISTS cargos (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(120) NOT NULL,
  area       VARCHAR(80)  NOT NULL,
  activo     TINYINT(1)   NOT NULL DEFAULT 1,
  orden      INT          NOT NULL DEFAULT 0,
  creado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Postulaciones recibidas desde la página Trabaja con nosotros
CREATE TABLE IF NOT EXISTS hojas_vida (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo           VARCHAR(20)  NULL,
  nombre           VARCHAR(150) NOT NULL,
  email            VARCHAR(190) NOT NULL,
  telefono         VARCHAR(40)  NOT NULL,
  cargo_id         INT UNSIGNED NULL,
  cargo_nombre     VARCHAR(120) NOT NULL,
  experiencia      ENUM('sin_experiencia', 'menos_1', 'entre_1_3', 'mas_3') NOT NULL,
  descripcion      TEXT         NULL,
  archivo          VARCHAR(255) NOT NULL,
  nombre_original  VARCHAR(255) NOT NULL,
  mime             VARCHAR(100) NOT NULL,
  tamano           INT UNSIGNED NOT NULL,
  autoriza_datos   DATETIME     NOT NULL,
  estado           ENUM('nueva', 'revisada', 'preseleccionada', 'descartada') NOT NULL DEFAULT 'nueva',
  notas            TEXT         NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hojas_vida_codigo (codigo),
  KEY idx_hojas_vida_estado (estado),
  KEY idx_hojas_vida_cargo (cargo_id),
  CONSTRAINT fk_hojas_vida_cargo FOREIGN KEY (cargo_id) REFERENCES cargos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Textos del sitio que el administrador puede editar
CREATE TABLE IF NOT EXISTS contenido (
  clave           VARCHAR(60) NOT NULL,
  valor           TEXT        NOT NULL,
  actualizado_en  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Noticias de la página principal
CREATE TABLE IF NOT EXISTS noticias (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo          VARCHAR(160) NOT NULL,
  resumen         TEXT         NOT NULL,
  fecha           DATE         NOT NULL,
  imagen          VARCHAR(255) NULL,
  imagen_mime     VARCHAR(50)  NULL,
  visible         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
