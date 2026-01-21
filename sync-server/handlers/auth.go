package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"masscode-sync-server/middleware"
	"masscode-sync-server/models"
)

type RegisterRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type RegisterResponse struct {
	UserID  string `json:"user_id"`
	APIKey  string `json:"api_key"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

type LoginRequest struct {
	APIKey string `json:"api_key" binding:"required"`
}

type LoginResponse struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

// Register creates a new user and generates an API key
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := models.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		// User exists, return existing API key
		c.JSON(http.StatusOK, RegisterResponse{
			UserID:  existingUser.ID,
			APIKey:  existingUser.APIKey,
			Email:   existingUser.Email,
			Message: "User already exists",
		})
		return
	}

	// Generate API key
	apiKey := uuid.New().String()

	// Create new user
	user := models.User{
		ID:        uuid.New().String(),
		Email:     req.Email,
		APIKey:    apiKey,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := models.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, RegisterResponse{
		UserID:  user.ID,
		APIKey:  user.APIKey,
		Email:   user.Email,
		Message: "User registered successfully",
	})
}

// Login validates an API key and returns user info
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := models.DB.Where("api_key = ?", req.APIKey).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		UserID: user.ID,
		Email:  user.Email,
	})
}
