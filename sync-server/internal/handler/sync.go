package handler

import (
	"masscode-sync-server/internal/database"
	"masscode-sync-server/internal/model"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Ping handles the ping request to test connection
func Ping(c *gin.Context) {
	c.JSON(http.StatusOK, PingResponse{
		ServerTime: time.Now().UnixMilli(),
	})
}

// Push handles the push request from client
func Push(c *gin.Context) {
	var req PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()
	var idMappings []IDMapping

	// Process in transaction
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Process folders
	for _, item := range req.Changes.Folders {
		if item.IsNew {
			serverID := uuid.New().String()
			folder := model.Folder{
				ID:              serverID,
				Name:            getString(item.Data, "name"),
				DefaultLanguage: getString(item.Data, "defaultLanguage"),
				ParentID:        getStringPtr(item.Data, "parentId"),
				IsOpen:          getInt(item.Data, "isOpen"),
				OrderIndex:      getInt(item.Data, "orderIndex"),
				Icon:            getStringPtr(item.Data, "icon"),
				CreatedAt:       getInt64(item.Data, "createdAt"),
				UpdatedAt:       getInt64(item.Data, "updatedAt"),
			}
			if err := tx.Create(&folder).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			idMappings = append(idMappings, IDMapping{
				TableName: "folders",
				LocalID:   item.LocalID,
				ServerID:  serverID,
			})
		} else if item.ServerID != nil {
			// Update existing - Last Write Wins
			var existing model.Folder
			if err := tx.First(&existing, "id = ?", *item.ServerID).Error; err == nil {
				incomingUpdatedAt := getInt64(item.Data, "updatedAt")
				if incomingUpdatedAt > existing.UpdatedAt {
					updates := map[string]interface{}{
						"name":             getString(item.Data, "name"),
						"default_language": getString(item.Data, "defaultLanguage"),
						"parent_id":        getStringPtr(item.Data, "parentId"),
						"is_open":          getInt(item.Data, "isOpen"),
						"order_index":      getInt(item.Data, "orderIndex"),
						"icon":             getStringPtr(item.Data, "icon"),
						"updated_at":       incomingUpdatedAt,
					}
					tx.Model(&existing).Updates(updates)
				}
			}
		}
	}

	// Process tags
	for _, item := range req.Changes.Tags {
		if item.IsNew {
			serverID := uuid.New().String()
			tag := model.Tag{
				ID:        serverID,
				Name:      getString(item.Data, "name"),
				CreatedAt: getInt64(item.Data, "createdAt"),
				UpdatedAt: getInt64(item.Data, "updatedAt"),
			}
			if err := tx.Create(&tag).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			idMappings = append(idMappings, IDMapping{
				TableName: "tags",
				LocalID:   item.LocalID,
				ServerID:  serverID,
			})
		} else if item.ServerID != nil {
			var existing model.Tag
			if err := tx.First(&existing, "id = ?", *item.ServerID).Error; err == nil {
				incomingUpdatedAt := getInt64(item.Data, "updatedAt")
				if incomingUpdatedAt > existing.UpdatedAt {
					updates := map[string]interface{}{
						"name":       getString(item.Data, "name"),
						"updated_at": incomingUpdatedAt,
					}
					tx.Model(&existing).Updates(updates)
				}
			}
		}
	}

	// Process snippets
	for _, item := range req.Changes.Snippets {
		if item.IsNew {
			serverID := uuid.New().String()
			snippet := model.Snippet{
				ID:          serverID,
				Name:        getString(item.Data, "name"),
				Description: getStringPtr(item.Data, "description"),
				FolderID:    getStringPtr(item.Data, "folderId"),
				IsDeleted:   getInt(item.Data, "isDeleted"),
				IsFavorites: getInt(item.Data, "isFavorites"),
				CreatedAt:   getInt64(item.Data, "createdAt"),
				UpdatedAt:   getInt64(item.Data, "updatedAt"),
			}
			if err := tx.Create(&snippet).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			idMappings = append(idMappings, IDMapping{
				TableName: "snippets",
				LocalID:   item.LocalID,
				ServerID:  serverID,
			})
		} else if item.ServerID != nil {
			var existing model.Snippet
			if err := tx.First(&existing, "id = ?", *item.ServerID).Error; err == nil {
				incomingUpdatedAt := getInt64(item.Data, "updatedAt")
				if incomingUpdatedAt > existing.UpdatedAt {
					updates := map[string]interface{}{
						"name":         getString(item.Data, "name"),
						"description":  getStringPtr(item.Data, "description"),
						"folder_id":    getStringPtr(item.Data, "folderId"),
						"is_deleted":   getInt(item.Data, "isDeleted"),
						"is_favorites": getInt(item.Data, "isFavorites"),
						"updated_at":   incomingUpdatedAt,
					}
					tx.Model(&existing).Updates(updates)
				}
			}
		}
	}

	// Process snippet contents
	for _, item := range req.Changes.SnippetContents {
		if item.IsNew {
			serverID := uuid.New().String()
			content := model.SnippetContent{
				ID:        serverID,
				SnippetID: getString(item.Data, "snippetId"),
				Label:     getStringPtr(item.Data, "label"),
				Value:     getStringPtr(item.Data, "value"),
				Language:  getStringPtr(item.Data, "language"),
				CreatedAt: getInt64(item.Data, "createdAt"),
				UpdatedAt: getInt64(item.Data, "updatedAt"),
			}
			if err := tx.Create(&content).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			idMappings = append(idMappings, IDMapping{
				TableName: "snippet_contents",
				LocalID:   item.LocalID,
				ServerID:  serverID,
			})
		} else if item.ServerID != nil {
			var existing model.SnippetContent
			if err := tx.First(&existing, "id = ?", *item.ServerID).Error; err == nil {
				incomingUpdatedAt := getInt64(item.Data, "updatedAt")
				if incomingUpdatedAt > existing.UpdatedAt {
					updates := map[string]interface{}{
						"snippet_id": getString(item.Data, "snippetId"),
						"label":      getStringPtr(item.Data, "label"),
						"value":      getStringPtr(item.Data, "value"),
						"language":   getStringPtr(item.Data, "language"),
						"updated_at": incomingUpdatedAt,
					}
					tx.Model(&existing).Updates(updates)
				}
			}
		}
	}

	// Process snippet tags
	for _, item := range req.Changes.SnippetTags {
		if item.IsNew {
			st := model.SnippetTag{
				SnippetID: item.SnippetServerID,
				TagID:     item.TagServerID,
				CreatedAt: item.CreatedAt,
			}
			// Use INSERT IGNORE to avoid duplicates
			tx.Exec("INSERT IGNORE INTO snippet_tags (snippet_id, tag_id, created_at) VALUES (?, ?, ?)",
				st.SnippetID, st.TagID, st.CreatedAt)
		}
	}

	// Process deletions
	for _, del := range req.Deletions {
		switch del.TableName {
		case "folders":
			tx.Delete(&model.Folder{}, "id = ?", del.RecordID)
		case "tags":
			tx.Delete(&model.SnippetTag{}, "tag_id = ?", del.RecordID)
			tx.Delete(&model.Tag{}, "id = ?", del.RecordID)
		case "snippet_contents":
			tx.Delete(&model.SnippetContent{}, "id = ?", del.RecordID)
		case "snippets":
			tx.Delete(&model.SnippetTag{}, "snippet_id = ?", del.RecordID)
			tx.Delete(&model.SnippetContent{}, "snippet_id = ?", del.RecordID)
			tx.Delete(&model.Snippet{}, "id = ?", del.RecordID)
		}
		// Record deletion for other clients
		syncDel := model.SyncDeletion{
			ID:          uuid.New().String(),
			EntityTable: del.TableName,
			RecordID:    del.RecordID,
			DeletedAt:   del.DeletedAt,
		}
		tx.Exec("INSERT IGNORE INTO sync_deletions (id, table_name, record_id, deleted_at) VALUES (?, ?, ?, ?)",
			syncDel.ID, syncDel.EntityTable, syncDel.RecordID, syncDel.DeletedAt)
	}

	tx.Commit()

	c.JSON(http.StatusOK, PushResponse{
		ServerTime: time.Now().UnixMilli(),
		IDMappings: idMappings,
	})
}

// Pull handles the pull request from client
func Pull(c *gin.Context) {
	var req PullRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()
	resp := PullResponse{
		ServerTime: time.Now().UnixMilli(),
	}

	// Get folders updated since lastSyncAt
	var folders []model.Folder
	db.Where("updated_at > ?", req.LastSyncAt).Find(&folders)
	for _, f := range folders {
		resp.Changes.Folders = append(resp.Changes.Folders, SyncFolderData{
			ID:              f.ID,
			Name:            f.Name,
			DefaultLanguage: f.DefaultLanguage,
			ParentID:        f.ParentID,
			IsOpen:          f.IsOpen,
			OrderIndex:      f.OrderIndex,
			Icon:            f.Icon,
			CreatedAt:       f.CreatedAt,
			UpdatedAt:       f.UpdatedAt,
		})
	}

	// Get tags
	var tags []model.Tag
	db.Where("updated_at > ?", req.LastSyncAt).Find(&tags)
	for _, t := range tags {
		resp.Changes.Tags = append(resp.Changes.Tags, SyncTagData{
			ID:        t.ID,
			Name:      t.Name,
			CreatedAt: t.CreatedAt,
			UpdatedAt: t.UpdatedAt,
		})
	}

	// Get snippets
	var snippets []model.Snippet
	db.Where("updated_at > ?", req.LastSyncAt).Find(&snippets)
	for _, s := range snippets {
		resp.Changes.Snippets = append(resp.Changes.Snippets, SyncSnippetData{
			ID:          s.ID,
			Name:        s.Name,
			Description: s.Description,
			FolderID:    s.FolderID,
			IsDeleted:   s.IsDeleted,
			IsFavorites: s.IsFavorites,
			CreatedAt:   s.CreatedAt,
			UpdatedAt:   s.UpdatedAt,
		})
	}

	// Get snippet contents
	var contents []model.SnippetContent
	db.Where("updated_at > ?", req.LastSyncAt).Find(&contents)
	for _, c := range contents {
		resp.Changes.SnippetContents = append(resp.Changes.SnippetContents, SyncSnippetContentData{
			ID:        c.ID,
			SnippetID: c.SnippetID,
			Label:     c.Label,
			Value:     c.Value,
			Language:  c.Language,
			CreatedAt: c.CreatedAt,
			UpdatedAt: c.UpdatedAt,
		})
	}

	// Get snippet tags (for updated snippets)
	var snippetTags []model.SnippetTag
	db.Where("created_at > ?", req.LastSyncAt).Find(&snippetTags)
	for _, st := range snippetTags {
		resp.Changes.SnippetTags = append(resp.Changes.SnippetTags, SyncSnippetTagData{
			SnippetID: st.SnippetID,
			TagID:     st.TagID,
			CreatedAt: st.CreatedAt,
		})
	}

	// Get deletions
	var deletions []model.SyncDeletion
	db.Where("deleted_at > ?", req.LastSyncAt).Find(&deletions)
	for _, d := range deletions {
		resp.Deletions = append(resp.Deletions, SyncDeletionData{
			TableName: d.EntityTable,
			RecordID:  d.RecordID,
			DeletedAt: d.DeletedAt,
		})
	}

	// Initialize empty slices if nil
	if resp.Changes.Folders == nil {
		resp.Changes.Folders = []SyncFolderData{}
	}
	if resp.Changes.Tags == nil {
		resp.Changes.Tags = []SyncTagData{}
	}
	if resp.Changes.Snippets == nil {
		resp.Changes.Snippets = []SyncSnippetData{}
	}
	if resp.Changes.SnippetContents == nil {
		resp.Changes.SnippetContents = []SyncSnippetContentData{}
	}
	if resp.Changes.SnippetTags == nil {
		resp.Changes.SnippetTags = []SyncSnippetTagData{}
	}
	if resp.Deletions == nil {
		resp.Deletions = []SyncDeletionData{}
	}

	c.JSON(http.StatusOK, resp)
}

// Full handles the full sync request (returns all data)
func Full(c *gin.Context) {
	db := database.GetDB()
	resp := PullResponse{
		ServerTime: time.Now().UnixMilli(),
	}

	// Get all folders
	var folders []model.Folder
	db.Find(&folders)
	for _, f := range folders {
		resp.Changes.Folders = append(resp.Changes.Folders, SyncFolderData{
			ID:              f.ID,
			Name:            f.Name,
			DefaultLanguage: f.DefaultLanguage,
			ParentID:        f.ParentID,
			IsOpen:          f.IsOpen,
			OrderIndex:      f.OrderIndex,
			Icon:            f.Icon,
			CreatedAt:       f.CreatedAt,
			UpdatedAt:       f.UpdatedAt,
		})
	}

	// Get all tags
	var tags []model.Tag
	db.Find(&tags)
	for _, t := range tags {
		resp.Changes.Tags = append(resp.Changes.Tags, SyncTagData{
			ID:        t.ID,
			Name:      t.Name,
			CreatedAt: t.CreatedAt,
			UpdatedAt: t.UpdatedAt,
		})
	}

	// Get all snippets
	var snippets []model.Snippet
	db.Find(&snippets)
	for _, s := range snippets {
		resp.Changes.Snippets = append(resp.Changes.Snippets, SyncSnippetData{
			ID:          s.ID,
			Name:        s.Name,
			Description: s.Description,
			FolderID:    s.FolderID,
			IsDeleted:   s.IsDeleted,
			IsFavorites: s.IsFavorites,
			CreatedAt:   s.CreatedAt,
			UpdatedAt:   s.UpdatedAt,
		})
	}

	// Get all snippet contents
	var contents []model.SnippetContent
	db.Find(&contents)
	for _, c := range contents {
		resp.Changes.SnippetContents = append(resp.Changes.SnippetContents, SyncSnippetContentData{
			ID:        c.ID,
			SnippetID: c.SnippetID,
			Label:     c.Label,
			Value:     c.Value,
			Language:  c.Language,
			CreatedAt: c.CreatedAt,
			UpdatedAt: c.UpdatedAt,
		})
	}

	// Get all snippet tags
	var snippetTags []model.SnippetTag
	db.Find(&snippetTags)
	for _, st := range snippetTags {
		resp.Changes.SnippetTags = append(resp.Changes.SnippetTags, SyncSnippetTagData{
			SnippetID: st.SnippetID,
			TagID:     st.TagID,
			CreatedAt: st.CreatedAt,
		})
	}

	// Initialize empty slices if nil
	if resp.Changes.Folders == nil {
		resp.Changes.Folders = []SyncFolderData{}
	}
	if resp.Changes.Tags == nil {
		resp.Changes.Tags = []SyncTagData{}
	}
	if resp.Changes.Snippets == nil {
		resp.Changes.Snippets = []SyncSnippetData{}
	}
	if resp.Changes.SnippetContents == nil {
		resp.Changes.SnippetContents = []SyncSnippetContentData{}
	}
	if resp.Changes.SnippetTags == nil {
		resp.Changes.SnippetTags = []SyncSnippetTagData{}
	}
	resp.Deletions = []SyncDeletionData{}

	c.JSON(http.StatusOK, resp)
}

// Helper functions
func getString(data map[string]interface{}, key string) string {
	if v, ok := data[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getStringPtr(data map[string]interface{}, key string) *string {
	if v, ok := data[key]; ok {
		if v == nil {
			return nil
		}
		if s, ok := v.(string); ok {
			return &s
		}
	}
	return nil
}

func getInt(data map[string]interface{}, key string) int {
	if v, ok := data[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		case int64:
			return int(n)
		}
	}
	return 0
}

func getInt64(data map[string]interface{}, key string) int64 {
	if v, ok := data[key]; ok {
		switch n := v.(type) {
		case float64:
			return int64(n)
		case int:
			return int64(n)
		case int64:
			return n
		}
	}
	return 0
}
