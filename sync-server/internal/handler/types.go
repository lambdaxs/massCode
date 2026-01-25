package handler

// Sync data types for API requests/responses

type SyncFolderData struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	DefaultLanguage string  `json:"defaultLanguage"`
	ParentID        *string `json:"parentId"`
	IsOpen          int     `json:"isOpen"`
	OrderIndex      int     `json:"orderIndex"`
	Icon            *string `json:"icon"`
	CreatedAt       int64   `json:"createdAt"`
	UpdatedAt       int64   `json:"updatedAt"`
}

type SyncSnippetData struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	FolderID    *string `json:"folderId"`
	IsDeleted   int     `json:"isDeleted"`
	IsFavorites int     `json:"isFavorites"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
}

type SyncSnippetContentData struct {
	ID        string  `json:"id"`
	SnippetID string  `json:"snippetId"`
	Label     *string `json:"label"`
	Value     *string `json:"value"`
	Language  *string `json:"language"`
	CreatedAt int64   `json:"createdAt"`
	UpdatedAt int64   `json:"updatedAt"`
}

type SyncTagData struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type SyncSnippetTagData struct {
	SnippetID string `json:"snippetId"`
	TagID     string `json:"tagId"`
	CreatedAt int64  `json:"createdAt"`
}

type SyncDeletionData struct {
	TableName string `json:"tableName"`
	RecordID  string `json:"recordId"`
	DeletedAt int64  `json:"deletedAt"`
}

// Push request types
type PushFolderChangeItem struct {
	ServerID *string                `json:"serverId"`
	LocalID  int                    `json:"localId"`
	Data     map[string]interface{} `json:"data"`
	IsNew    bool                   `json:"isNew"`
}

type PushSnippetChangeItem struct {
	ServerID *string                `json:"serverId"`
	LocalID  int                    `json:"localId"`
	Data     map[string]interface{} `json:"data"`
	IsNew    bool                   `json:"isNew"`
}

type PushSnippetContentChangeItem struct {
	ServerID *string                `json:"serverId"`
	LocalID  int                    `json:"localId"`
	Data     map[string]interface{} `json:"data"`
	IsNew    bool                   `json:"isNew"`
}

type PushTagChangeItem struct {
	ServerID *string                `json:"serverId"`
	LocalID  int                    `json:"localId"`
	Data     map[string]interface{} `json:"data"`
	IsNew    bool                   `json:"isNew"`
}

type PushSnippetTagItem struct {
	SnippetServerID string `json:"snippetServerId"`
	TagServerID     string `json:"tagServerId"`
	IsNew           bool   `json:"isNew"`
	CreatedAt       int64  `json:"createdAt"`
}

type PushRequest struct {
	Changes struct {
		Folders         []PushFolderChangeItem         `json:"folders"`
		Snippets        []PushSnippetChangeItem        `json:"snippets"`
		SnippetContents []PushSnippetContentChangeItem `json:"snippetContents"`
		Tags            []PushTagChangeItem            `json:"tags"`
		SnippetTags     []PushSnippetTagItem           `json:"snippetTags"`
	} `json:"changes"`
	Deletions []SyncDeletionData `json:"deletions"`
}

type IDMapping struct {
	TableName string `json:"tableName"`
	LocalID   int    `json:"localId"`
	ServerID  string `json:"serverId"`
}

type PushResponse struct {
	ServerTime int64       `json:"serverTime"`
	IDMappings []IDMapping `json:"idMappings"`
}

// Pull request/response types
type PullRequest struct {
	LastSyncAt int64 `json:"lastSyncAt"`
}

type PullResponse struct {
	ServerTime int64 `json:"serverTime"`
	Changes    struct {
		Folders         []SyncFolderData         `json:"folders"`
		Snippets        []SyncSnippetData        `json:"snippets"`
		SnippetContents []SyncSnippetContentData `json:"snippetContents"`
		Tags            []SyncTagData            `json:"tags"`
		SnippetTags     []SyncSnippetTagData     `json:"snippetTags"`
	} `json:"changes"`
	Deletions []SyncDeletionData `json:"deletions"`
}

type PingResponse struct {
	ServerTime int64 `json:"serverTime"`
}
