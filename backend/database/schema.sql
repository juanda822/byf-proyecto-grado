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
  cliente                    VARCHAR(150) NOT NULL,
  numero_pedido              VARCHAR(40)  NOT NULL,
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
