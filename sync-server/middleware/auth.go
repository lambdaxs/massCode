package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"masscode-sync-server/models"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
)

// AuthMiddleware validates API key and sets user context
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get API key from header
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Try from Authorization header
			auth := c.GetHeader("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				apiKey = strings.TrimPrefix(auth, "Bearer ")
			}
		}

		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API key required"})
			c.Abort()
			return
		}

		// Find user by API key
		var user models.User
		if err := models.DB.Where("api_key = ?", apiKey).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
				c.Abort()
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			c.Abort()
			return
		}

		// Set user in context
		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}

// GetUser retrieves the user from context
func GetUser(c *gin.Context) (*models.User, bool) {
	user, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	return user.(*models.User), true
}

// GetUserID retrieves the user ID from context
func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	return userID.(string), true
}
