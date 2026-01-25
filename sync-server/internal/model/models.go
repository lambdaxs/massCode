package model

// Folder represents a folder in the database
type Folder struct {
	ID              string  `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name            string  `json:"name" gorm:"type:varchar(255);not null"`
	DefaultLanguage string  `json:"defaultLanguage" gorm:"type:varchar(50);not null"`
	ParentID        *string `json:"parentId" gorm:"type:varchar(36)"`
	IsOpen          int     `json:"isOpen" gorm:"type:tinyint(1);not null;default:0"`
	OrderIndex      int     `json:"orderIndex" gorm:"type:int;not null;default:0"`
	Icon            *string `json:"icon" gorm:"type:varchar(100)"`
	CreatedAt       int64   `json:"createdAt" gorm:"type:bigint;not null"`
	UpdatedAt       int64   `json:"updatedAt" gorm:"type:bigint;not null;index"`
}

func (Folder) TableName() string {
	return "folders"
}

// Snippet represents a code snippet in the database
type Snippet struct {
	ID          string  `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name        string  `json:"name" gorm:"type:varchar(255);not null"`
	Description *string `json:"description" gorm:"type:text"`
	FolderID    *string `json:"folderId" gorm:"type:varchar(36);index"`
	IsDeleted   int     `json:"isDeleted" gorm:"type:tinyint(1);not null;default:0"`
	IsFavorites int     `json:"isFavorites" gorm:"type:tinyint(1);not null;default:0"`
	CreatedAt   int64   `json:"createdAt" gorm:"type:bigint;not null"`
	UpdatedAt   int64   `json:"updatedAt" gorm:"type:bigint;not null;index"`
}

func (Snippet) TableName() string {
	return "snippets"
}

// SnippetContent represents the content of a snippet
type SnippetContent struct {
	ID        string  `json:"id" gorm:"primaryKey;type:varchar(36)"`
	SnippetID string  `json:"snippetId" gorm:"type:varchar(36);not null;index"`
	Label     *string `json:"label" gorm:"type:varchar(255)"`
	Value     *string `json:"value" gorm:"type:longtext"`
	Language  *string `json:"language" gorm:"type:varchar(50)"`
	CreatedAt int64   `json:"createdAt" gorm:"type:bigint;not null"`
	UpdatedAt int64   `json:"updatedAt" gorm:"type:bigint;not null;index"`
}

func (SnippetContent) TableName() string {
	return "snippet_contents"
}

// Tag represents a tag in the database
type Tag struct {
	ID        string `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name      string `json:"name" gorm:"type:varchar(100);not null;uniqueIndex"`
	CreatedAt int64  `json:"createdAt" gorm:"type:bigint;not null"`
	UpdatedAt int64  `json:"updatedAt" gorm:"type:bigint;not null;index"`
}

func (Tag) TableName() string {
	return "tags"
}

// SnippetTag represents the many-to-many relationship between snippets and tags
type SnippetTag struct {
	SnippetID string `json:"snippetId" gorm:"primaryKey;type:varchar(36)"`
	TagID     string `json:"tagId" gorm:"primaryKey;type:varchar(36)"`
	CreatedAt int64  `json:"createdAt" gorm:"type:bigint;not null;index"`
}

func (SnippetTag) TableName() string {
	return "snippet_tags"
}

// SyncDeletion records deleted items for sync
type SyncDeletion struct {
	ID           string `json:"id" gorm:"primaryKey;type:varchar(36)"`
	EntityTable  string `json:"tableName" gorm:"column:table_name;type:varchar(50);not null"`
	RecordID     string `json:"recordId" gorm:"type:varchar(36);not null;uniqueIndex:uk_table_record"`
	DeletedAt    int64  `json:"deletedAt" gorm:"type:bigint;not null;index"`
}

func (SyncDeletion) TableName() string {
	return "sync_deletions"
}
