package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"masscode-sync-server/middleware"
	"masscode-sync-server/models"
)

// RegisterDeviceRequest represents the device registration request
type RegisterDeviceRequest struct {
	Name string `json:"name" binding:"required"`
}

// RegisterDeviceResponse represents the device registration response
type RegisterDeviceResponse struct {
	DeviceID string `json:"device_id"`
	Name     string `json:"name"`
	Message  string `json:"message"`
}

// RegisterDevice registers a new device for the user
func RegisterDevice(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device := models.Device{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      req.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := models.DB.Create(&device).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register device"})
		return
	}

	c.JSON(http.StatusCreated, RegisterDeviceResponse{
		DeviceID: device.ID,
		Name:     device.Name,
		Message:  "Device registered successfully",
	})
}

// ListDevices returns all devices for the user
func ListDevices(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var devices []models.Device
	if err := models.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&devices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch devices"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"devices": devices,
	})
}
