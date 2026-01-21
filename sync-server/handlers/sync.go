package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"masscode-sync-server/models"
)

// SyncRequest represents the sync request from client
type SyncRequest struct {
	LastSyncTimestamp *int64 `json:"last_sync_timestamp"`
}

// PullData represents the data to pull from server
type PullData struct {
	Folders  []models.Folder  `json:"folders"`
	Snippets []SnippetSyncItem `json:"snippets"`
	Tags     []models.Tag     `json:"tags"`
}

// SnippetSyncItem extends Snippet with content and tag information
type SnippetSyncItem struct {
	models.Snippet
	Contents    []models.SnippetContent `json:"contents"`
	TagSyncIDs  []string                `json:"tag_sync_ids"`
}

// SyncResponse represents the sync response
type SyncResponse struct {
	ServerTimestamp int64     `json:"server_timestamp"`
	SyncID          string    `json:"sync_id"`
	PullData        PullData  `json:"pull_data"`
}

// PushRequest represents the push request from client
type PushRequest struct {
	Folders  []models.Folder      `json:"folders"`
	Snippets []SnippetSyncItemPush `json:"snippets"`
	Tags     []models.Tag         `json:"tags"`
}

// SnippetSyncItemPush represents a snippet to push
type SnippetSyncItemPush struct {
	models.Snippet
	Contents   []models.SnippetContent `json:"contents"`
	TagSyncIDs []string                `json:"tag_sync_ids"`
}

// PushResponse represents the push response
type PushResponse struct {
	Success         bool     `json:"success"`
	FoldersSynced   int      `json:"folders_synced"`
	SnippetsSynced  int      `json:"snippets_synced"`
	TagsSynced      int      `json:"tags_synced"`
	ServerTimestamp int64    `json:"server_timestamp"`
}

// PullSync handles pull sync requests
func PullSync(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var lastSync int64
	if req.LastSyncTimestamp != nil {
		lastSync = *req.LastSyncTimestamp
	}

	// Fetch updated folders
	var folders []models.Folder
	query := models.DB.Where("user_id = ?", userID)
	if lastSync > 0 {
		query = query.Where("updated_at > ?", lastSync)
	}
	query.Find(&folders)

	// Fetch updated snippets with contents
	var snippets []models.Snippet
	snippetQuery := models.DB.Preload("Contents").Where("user_id = ?", userID)
	if lastSync > 0 {
		snippetQuery = snippetQuery.Where("updated_at > ?", lastSync)
	}
	snippetQuery.Find(&snippets)

	// Convert to SnippetSyncItem with tags
	snippetItems := make([]SnippetSyncItem, 0, len(snippets))
	for _, snippet := range snippets {
		// Get tag sync IDs for this snippet
		var tagSyncIDs []string
		models.DB.Table("snippet_tags").
			Where("snippet_sync_id = ?", snippet.SyncID).
			Pluck("tag_sync_id", &tagSyncIDs)

		snippetItems = append(snippetItems, SnippetSyncItem{
			Snippet:    snippet,
			Contents:   snippet.Contents,
			TagSyncIDs: tagSyncIDs,
		})
	}

	// Fetch updated tags
	var tags []models.Tag
	tagQuery := models.DB.Where("user_id = ?", userID)
	if lastSync > 0 {
		tagQuery = tagQuery.Where("updated_at > ?", lastSync)
	}
	tagQuery.Find(&tags)

	c.JSON(http.StatusOK, SyncResponse{
		ServerTimestamp: time.Now().UnixMilli(),
		SyncID:          uuid.New().String(),
		PullData: PullData{
			Folders:  folders,
			Snippets: snippetItems,
			Tags:     tags,
		},
	})
}

// PushSync handles push sync requests
func PushSync(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	foldersSynced := 0
	snippetsSynced := 0
	tagsSynced := 0

	// Use transaction for atomicity
	err := models.DB.Transaction(func(tx *gorm.DB) error {
		// Sync folders
		for _, folder := range req.Folders {
			folder.UserID = userID
			if folder.SyncID == "" {
				folder.SyncID = uuid.New().String()
			}

			var existing models.Folder
			if err := tx.Where("sync_id = ? AND user_id = ?", folder.SyncID, userID).First(&existing).Error; err == nil {
				// Update existing folder if server version is newer
				if folder.ServerVersion > existing.ServerVersion {
					folder.UpdatedAt = time.Now().UnixMilli()
					tx.Model(&existing).Updates(folder)
				}
			} else {
				// Create new folder
				folder.CreatedAt = time.Now().UnixMilli()
				folder.UpdatedAt = time.Now().UnixMilli()
				if err := tx.Create(&folder).Error; err != nil {
					return err
				}
			}
			foldersSynced++
		}

		// Sync tags first (snippets reference them)
		for _, tag := range req.Tags {
			tag.UserID = userID
			if tag.SyncID == "" {
				tag.SyncID = uuid.New().String()
			}

			var existing models.Tag
			if err := tx.Where("sync_id = ? AND user_id = ?", tag.SyncID, userID).First(&existing).Error; err == nil {
				if tag.ServerVersion > existing.ServerVersion {
					tag.UpdatedAt = time.Now().UnixMilli()
					tx.Model(&existing).Updates(tag)
				}
			} else {
				tag.CreatedAt = time.Now().UnixMilli()
				tag.UpdatedAt = time.Now().UnixMilli()
				if err := tx.Create(&tag).Error; err != nil {
					return err
				}
			}
			tagsSynced++
		}

		// Sync snippets
		for _, snippet := range req.Snippets {
			snippet.UserID = userID
			if snippet.SyncID == "" {
				snippet.SyncID = uuid.New().String()
			}

			var existing models.Snippet
			if err := tx.Preload("Contents").Where("sync_id = ? AND user_id = ?", snippet.SyncID, userID).First(&existing).Error; err == nil {
				if snippet.ServerVersion > existing.ServerVersion {
					snippet.UpdatedAt = time.Now().UnixMilli()
					tx.Model(&existing).Omit("Contents").Updates(&snippet.Snippet)

					// Delete old contents
					tx.Where("snippet_sync_id = ?", snippet.SyncID).Delete(&models.SnippetContent{})

					// Insert new contents
					for _, content := range snippet.Contents {
						content.SnippetSyncID = snippet.SyncID
						tx.Create(&content)
					}

					// Update tag relationships
					tx.Where("snippet_sync_id = ?", snippet.SyncID).Delete(&models.SnippetTag{})
					for _, tagSyncID := range snippet.TagSyncIDs {
						tx.Create(&models.SnippetTag{
							SnippetSyncID: snippet.SyncID,
							TagSyncID:     tagSyncID,
						})
					}
				}
			} else {
				snippet.CreatedAt = time.Now().UnixMilli()
				snippet.UpdatedAt = time.Now().UnixMilli()
				if err := tx.Omit("Contents").Create(&snippet.Snippet).Error; err != nil {
					return err
				}

				// Insert contents
				for _, content := range snippet.Contents {
					content.SnippetSyncID = snippet.SyncID
					if err := tx.Create(&content).Error; err != nil {
						return err
					}
				}

				// Insert tag relationships
				for _, tagSyncID := range snippet.TagSyncIDs {
					if err := tx.Create(&models.SnippetTag{
						SnippetSyncID: snippet.SyncID,
						TagSyncID:     tagSyncID,
					}).Error; err != nil {
						return err
					}
				}
			}
			snippetsSynced++
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PushResponse{
		Success:         true,
		FoldersSynced:   foldersSynced,
		SnippetsSynced:  snippetsSynced,
		TagsSynced:      tagsSynced,
		ServerTimestamp: time.Now().UnixMilli(),
	})
}

// SyncStatus returns the sync status
func SyncStatus(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var folderCount, snippetCount, tagCount int64

	models.DB.Model(&models.Folder{}).Where("user_id = ?", userID).Count(&folderCount)
	models.DB.Model(&models.Snippet{}).Where("user_id = ?", userID).Count(&snippetCount)
	models.DB.Model(&models.Tag{}).Where("user_id = ?", userID).Count(&tagCount)

	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"total_folders":  folderCount,
			"total_snippets": snippetCount,
			"total_tags":     tagCount,
		},
	})
}
