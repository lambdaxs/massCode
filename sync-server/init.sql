-- Create database
CREATE DATABASE IF NOT EXISTS masscode_sync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE masscode_sync;

-- Create user (optional, you can use root for development)
-- CREATE USER IF NOT EXISTS 'masscode'@'localhost' IDENTIFIED BY 'masscode123';
-- GRANT ALL PRIVILEGES ON masscode_sync.* TO 'masscode'@'localhost';
-- FLUSH PRIVILEGES;

-- Tables will be auto-created by GORM AutoMigrate
-- But here's the schema for reference:

-- CREATE TABLE users (
--     id VARCHAR(36) PRIMARY KEY,
--     email VARCHAR(255) NOT NULL UNIQUE,
--     api_key VARCHAR(64) NOT NULL UNIQUE,
--     created_at DATETIME NOT NULL,
--     updated_at DATETIME NOT NULL,
--     deleted_at DATETIME,
--     INDEX idx_deleted_at (deleted_at)
-- );

-- CREATE TABLE devices (
--     id VARCHAR(36) PRIMARY KEY,
--     user_id VARCHAR(36) NOT NULL,
--     name VARCHAR(100) NOT NULL,
--     last_sync BIGINT,
--     created_at DATETIME NOT NULL,
--     updated_at DATETIME NOT NULL,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_user_id (user_id)
-- );

-- CREATE TABLE folders (
--     sync_id VARCHAR(36) PRIMARY KEY,
--     user_id VARCHAR(36) NOT NULL,
--     server_version INT NOT NULL DEFAULT 1,
--     name VARCHAR(500) NOT NULL,
--     parent_sync_id VARCHAR(36),
--     default_language VARCHAR(50),
--     is_open BOOLEAN DEFAULT FALSE,
--     icon VARCHAR(100),
--     order_index INT DEFAULT 0,
--     created_at BIGINT NOT NULL,
--     updated_at BIGINT NOT NULL,
--     deleted_at BIGINT,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_user_id (user_id),
--     INDEX idx_updated_at (updated_at),
--     INDEX idx_deleted_at (deleted_at)
-- );

-- CREATE TABLE snippets (
--     sync_id VARCHAR(36) PRIMARY KEY,
--     user_id VARCHAR(36) NOT NULL,
--     server_version INT NOT NULL DEFAULT 1,
--     name VARCHAR(500) NOT NULL,
--     description TEXT,
--     folder_sync_id VARCHAR(36),
--     is_deleted BOOLEAN DEFAULT FALSE,
--     is_favorites BOOLEAN DEFAULT FALSE,
--     created_at BIGINT NOT NULL,
--     updated_at BIGINT NOT NULL,
--     deleted_at BIGINT,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_user_id (user_id),
--     INDEX idx_folder_sync_id (folder_sync_id),
--     INDEX idx_updated_at (updated_at),
--     INDEX idx_deleted_at (deleted_at)
-- );

-- CREATE TABLE snippet_contents (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     snippet_sync_id VARCHAR(36) NOT NULL,
--     label VARCHAR(500),
--     value TEXT,
--     language VARCHAR(50),
--     FOREIGN KEY (snippet_sync_id) REFERENCES snippets(sync_id),
--     INDEX idx_snippet_sync_id (snippet_sync_id)
-- );

-- CREATE TABLE tags (
--     sync_id VARCHAR(36) PRIMARY KEY,
--     user_id VARCHAR(36) NOT NULL,
--     server_version INT NOT NULL DEFAULT 1,
--     name VARCHAR(100) NOT NULL,
--     created_at BIGINT NOT NULL,
--     updated_at BIGINT NOT NULL,
--     deleted_at BIGINT,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_user_id (user_id),
--     INDEX idx_updated_at (updated_at),
--     INDEX idx_deleted_at (deleted_at)
-- );

-- CREATE TABLE snippet_tags (
--     snippet_sync_id VARCHAR(36) NOT NULL,
--     tag_sync_id VARCHAR(36) NOT NULL,
--     PRIMARY KEY (snippet_sync_id, tag_sync_id),
--     FOREIGN KEY (snippet_sync_id) REFERENCES snippets(sync_id),
--     FOREIGN KEY (tag_sync_id) REFERENCES tags(sync_id)
-- );
