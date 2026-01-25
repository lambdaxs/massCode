package models

import (
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

// User represents a user account
type User struct {
	ID        string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	Email     string         `gorm:"uniqueIndex;type:varchar(255);not null" json:"email"`
	APIKey    string         `gorm:"uniqueIndex;type:varchar(64);not null" json:"api_key"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Devices   []Device       `json:"devices,omitempty"`
	Folders   []Folder       `json:"folders,omitempty"`
	Snippets  []Snippet      `json:"snippets,omitempty"`
	Tags      []Tag          `json:"tags,omitempty"`
}

// Device represents a client device
type Device struct {
	ID        string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID    string    `gorm:"index;type:varchar(36);not null" json:"user_id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"` // e.g., "工作电脑", "家里Mac"
	LastSync  *int64    `gorm:"type:bigint" json:"last_sync"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
}

// Folder represents a code folder
type Folder struct {
	SyncID         string    `gorm:"primaryKey;type:varchar(36)" json:"sync_id"`
	UserID         string    `gorm:"index;type:varchar(36);not null" json:"user_id"`
	ServerVersion  int       `gorm:"not null;default:1" json:"server_version"`
	Name           string    `gorm:"type:varchar(500);not null" json:"name"`
	ParentSyncID   *string   `gorm:"type:varchar(36)" json:"parent_sync_id,omitempty"`
	DefaultLang    *string   `gorm:"type:varchar(50)" json:"default_language,omitempty"`
	IsOpen         bool      `gorm:"default:false" json:"is_open"`
	Icon           *string   `gorm:"type:varchar(100)" json:"icon,omitempty"`
	OrderIndex     int       `gorm:"default:0" json:"order_index"`
	CreatedAt      int64     `gorm:"not null" json:"created_at"`
	UpdatedAt      int64     `gorm:"not null;index" json:"updated_at"`
	DeletedAt      *int64    `gorm:"index" json:"deleted_at,omitempty"`
	User           User      `gorm:"foreignKey:UserID" json:"-"`
}

// Snippet represents a code snippet
type Snippet struct {
	SyncID        string          `gorm:"primaryKey;type:varchar(36)" json:"sync_id"`
	UserID        string          `gorm:"index;type:varchar(36);not null" json:"user_id"`
	ServerVersion int             `gorm:"not null;default:1" json:"server_version"`
	Name          string          `gorm:"type:varchar(500);not null" json:"name"`
	Description   *string         `gorm:"type:text" json:"description,omitempty"`
	FolderSyncID  *string         `gorm:"type:varchar(36);index" json:"folder_sync_id,omitempty"`
	IsDeleted     bool            `gorm:"default:false" json:"is_deleted"`
	IsFavorites   bool            `gorm:"default:false" json:"is_favorites"`
	CreatedAt     int64           `gorm:"not null" json:"created_at"`
	UpdatedAt     int64           `gorm:"not null;index" json:"updated_at"`
	DeletedAt     *int64          `gorm:"index" json:"deleted_at,omitempty"`
	User          User            `gorm:"foreignKey:UserID" json:"-"`
	Contents      []SnippetContent `gorm:"foreignKey:SnippetSyncID" json:"contents,omitempty"`
	Tags          []Tag           `gorm:"many2many:snippet_tags;joinForeignKey:SnippetSyncID;joinReferences:TagSyncID" json:"tags,omitempty"`
}

// SnippetContent represents the content of a snippet
type SnippetContent struct {
	ID            uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	SnippetSyncID string `gorm:"index;type:varchar(36);not null" json:"snippet_sync_id"`
	Label         *string `gorm:"type:varchar(500)" json:"label,omitempty"`
	Value         *string `gorm:"type:text" json:"value,omitempty"`
	Language      *string `gorm:"type:varchar(50)" json:"language,omitempty"`
	Snippet       Snippet `gorm:"foreignKey:SnippetSyncID" json:"-"`
}

// Tag represents a tag
type Tag struct {
	SyncID        string    `gorm:"primaryKey;type:varchar(36)" json:"sync_id"`
	UserID        string    `gorm:"index;type:varchar(36);not null" json:"user_id"`
	ServerVersion int       `gorm:"not null;default:1" json:"server_version"`
	Name          string    `gorm:"type:varchar(100);not null" json:"name"`
	CreatedAt     int64     `gorm:"not null" json:"created_at"`
	UpdatedAt     int64     `gorm:"not null;index" json:"updated_at"`
	DeletedAt     *int64    `gorm:"index" json:"deleted_at,omitempty"`
	User          User      `gorm:"foreignKey:UserID" json:"-"`
	Snippets      []Snippet `gorm:"many2many:snippet_tags;joinForeignKey:TagSyncID;joinReferences:SnippetSyncID" json:"snippets,omitempty"`
}

// SnippetTag represents the many-to-many relationship between snippets and tags
type SnippetTag struct {
	SnippetSyncID string `gorm:"primaryKey;type:varchar(36)" json:"snippet_sync_id"`
	TagSyncID     string `gorm:"primaryKey;type:varchar(36)" json:"tag_sync_id"`
}

// InitDB initializes the database connection
func InitDB() error {
	dsn := "masscode:masscode123@tcp(127.0.0.1:3306)/masscode_sync?charset=utf8mb4&parseTime=True&loc=Local"

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return err
	}

	DB = db
	return nil
}
