-- Create database
CREATE DATABASE IF NOT EXISTS masscode_sync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE masscode_sync;

-- Tables will be auto-created by GORM AutoMigrate
-- This script is for reference only

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  default_language VARCHAR(50) NOT NULL,
  parent_id VARCHAR(36) NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  icon VARCHAR(100) NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_updated_at (updated_at),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  folder_id VARCHAR(36) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  is_favorites TINYINT(1) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_updated_at (updated_at),
  INDEX idx_folder_id (folder_id),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Snippet contents table
CREATE TABLE IF NOT EXISTS snippet_contents (
  id VARCHAR(36) PRIMARY KEY,
  snippet_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NULL,
  value LONGTEXT NULL,
  language VARCHAR(50) NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_updated_at (updated_at),
  INDEX idx_snippet_id (snippet_id),
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Snippet tags table (many-to-many)
CREATE TABLE IF NOT EXISTS snippet_tags (
  snippet_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (snippet_id, tag_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sync deletions table
CREATE TABLE IF NOT EXISTS sync_deletions (
  id VARCHAR(36) PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id VARCHAR(36) NOT NULL,
  deleted_at BIGINT NOT NULL,
  INDEX idx_deleted_at (deleted_at),
  UNIQUE KEY uk_table_record (table_name, record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
