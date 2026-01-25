# massCode Sync Server

## 项目结构

```
sync-server/
├── main.go              # 主程序入口
├── go.mod               # Go 模块依赖
├── init.sql             # MySQL 数据库初始化脚本
├── config/              # 配置
│   └── config.go
├── models/              # 数据模型
│   └── models.go
├── handlers/            # HTTP 处理器
│   ├── auth.go          # 认证相关
│   ├── sync.go          # 同步相关
│   └── device.go        # 设备管理
└── middleware/          # 中间件
    └── auth.go          # 认证中间件
```

## 快速开始

### 1. 安装依赖

```bash
cd sync-server
go mod download
```

### 2. 初始化数据库

```bash
# 创建数据库和用户
mysql -u root -p < init.sql
```

### 3. 配置环境变量（可选）

```bash
export DATABASE_URL="masscode:masscode123@tcp(127.0.0.1:3306)/masscode_sync?charset=utf8mb4&parseTime=True&loc=Local"
export JWT_SECRET="your-secret-key"
export SERVER_PORT="8080"
```

### 4. 启动服务器

```bash
go run main.go
```

服务器将在 `http://localhost:8080` 启动。

## API 文档

### 认证相关

#### 注册用户

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com"
}
```

响应：
```json
{
  "user_id": "uuid",
  "api_key": "uuid-api-key",
  "email": "user@example.com",
  "message": "User registered successfully"
}
```

#### 登录验证

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "api_key": "your-api-key"
}
```

### 同步相关

所有同步请求需要在 Header 中包含 API Key：

```http
X-API-Key: your-api-key
```

#### 拉取同步

```http
POST /api/v1/sync/pull
X-API-Key: your-api-key
Content-Type: application/json

{
  "last_sync_timestamp": 1704067200000
}
```

响应：
```json
{
  "server_timestamp": 1704153600000,
  "sync_id": "uuid-sync-id",
  "pull_data": {
    "folders": [...],
    "snippets": [...],
    "tags": [...]
  }
}
```

#### 推送同步

```http
POST /api/v1/sync/push
X-API-Key: your-api-key
Content-Type: application/json

{
  "folders": [...],
  "snippets": [...],
  "tags": [...]
}
```

#### 同步状态

```http
GET /api/v1/sync/status
X-API-Key: your-api-key
```

### 设备相关

#### 注册设备

```http
POST /api/v1/devices/register
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "工作电脑"
}
```

#### 列出设备

```http
GET /api/v1/devices
X-API-Key: your-api-key
```

## 部署建议

### 使用 systemd

创建 `/etc/systemd/system/masscode-sync.service`：

```ini
[Unit]
Description=massCode Sync Server
After=network.target mysql.service

[Service]
Type=simple
User=masscode
WorkingDirectory=/opt/masscode-sync-server
ExecStart=/opt/masscode-sync-server/masscode-sync-server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 使用 Docker

```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o masscode-sync-server .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/masscode-sync-server .
COPY --from=builder /app/init.sql .
EXPOSE 8080
CMD ["./masscode-sync-server"]
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name sync.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 安全建议

1. **使用 HTTPS**: 生产环境务必使用 HTTPS
2. **定期更换 API Key**: 实现 API Key 轮换机制
3. **限流**: 添加请求频率限制
4. **日志**: 记录所有同步操作
5. **备份**: 定期备份数据库
