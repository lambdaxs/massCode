package config

import (
	"os"
)

type Config struct {
	DatabaseURL string
	JWTSecret  string
	ServerPort string
}

var AppConfig *Config

func LoadConfig() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "root:password@tcp(127.0.0.1:3306)/masscode_sync?charset=utf8mb4&parseTime=True&loc=Local"),
		JWTSecret:  getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func init() {
	AppConfig = LoadConfig()
}
