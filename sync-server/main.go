package main

import (
	"log"
	"masscode-sync-server/handlers"
	"masscode-sync-server/models"
	"masscode-sync-server/middleware"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
)

func main() {
	// Initialize database
	if err := models.InitDB(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Auto migrate
	if err := models.DB.AutoMigrate(
		&models.User{},
		&models.Device{},
		&models.Folder{},
		&models.Snippet{},
		&models.SnippetContent{},
		&models.Tag{},
		&models.SnippetTag{},
	); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Create Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		cors.Default().Handler(c.Writer, c.Request)
		c.Next()
	})

	// Public routes
	public := r.Group("/api/v1")
	{
		// Auth
		public.POST("/auth/register", handlers.Register)
		public.POST("/auth/login", handlers.Login)

		// Sync (requires auth)
		authorized := public.Group("")
		authorized.Use(middleware.AuthMiddleware())
		{
			authorized.POST("/sync/pull", handlers.PullSync)
			authorized.POST("/sync/push", handlers.PushSync)
			authorized.GET("/sync/status", handlers.SyncStatus)
			authorized.POST("/devices/register", handlers.RegisterDevice)
			authorized.GET("/devices", handlers.ListDevices)
		}
	}

	// Start server
	log.Println("Starting massCode sync server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
