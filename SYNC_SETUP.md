# massCode 云同步功能

## 概述

massCode 现在支持通过远程服务器进行数据同步，实现多设备间的代码片段同步。

## 特性

- **本地优先**: 所有数据首先存储在本地，离线也可使用
- **增量同步**: 只同步变更的数据，节省带宽和时间
- **时间戳合并**: 基于时间戳的自动冲突解决
- **安全认证**: 使用 API Key 进行身份验证

## 快速开始

### 1. 部署同步服务器

首先需要部署 massCode 同步服务器（见 `sync-server/README.md`）：

```bash
cd sync-server
mysql -u root -p < init.sql
go run main.go
```

服务器将在 `http://localhost:8080` 启动。

### 2. 注册账号

1. 打开 massCode
2. 进入 **Preferences** → **Sync**
3. 输入服务器地址（如 `http://localhost:8080`）
4. 输入邮箱地址
5. 点击 **Register** 按钮
6. 系统会自动生成 API Key

### 3. 启用同步

1. 保存生成的 API Key
2. 点击 **Enable Sync** 开关
3. 点击 **Sync Now** 进行首次同步

### 4. 在其他设备上使用

1. 在其他设备上安装 massCode
2. 进入 **Preferences** → **Sync**
3. 输入相同的服务器地址
4. 输入相同的 API Key
5. 启用同步并点击 **Sync Now**

## 工作原理

### 同步流程

```
┌─────────────────────────────────────────────────────────────┐
│                    本地优先                                  │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   客户端 A   │      │   客户端 B   │                   │
│  │  (公司电脑)  │      │  (家里电脑)  │                   │
│  └──────┬───────┘      └──────┬───────┘                   │
│         │                      │                           │
│         │ 1️⃣ 本地操作         │ 3️⃣ 下拉合并               │
│         ▼                      ▼                           │
│    [SQLite DB]            [SQLite DB]                       │
│         │                      │                           │
│         │ 2️⃣ 推送变更         │ 4️⃣ 推送变更               │
│         └──────────┬───────────┘                           │
│                    ▼                                        │
│              ┌──────────┐                                  │
│              │ 同步服务器 │                                  │
│              └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

### 数据模型

每个实体（folder, snippet, tag）都有以下同步字段：

- `syncId`: 全局唯一标识符
- `serverVersion`: 服务器版本号
- `deletedAt`: 软删除时间戳

### 冲突解决

采用"最后写入优先"策略：

1. 比较本地和服务器的时间戳
2. 选择更新时间较晚的版本
3. 软删除优先于更新

## API 文档

### 注册用户

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 拉取同步

```http
POST /api/v1/sync/pull
X-API-Key: your-api-key
Content-Type: application/json

{
  "last_sync_timestamp": 1704067200000
}
```

### 推送同步

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

## 数据安全

- 所有数据通过 HTTPS 加密传输（生产环境）
- API Key 存储在本地数据库
- 不会上传任何系统配置，只同步用户数据
- 支持随时禁用同步

## 故障排查

### 同步失败

1. 检查网络连接
2. 确认服务器地址正确
3. 验证 API Key 是否有效
4. 查看控制台日志

### 首次同步慢

首次同步需要上传所有本地数据，取决于数据量大小。后续同步只会传输变更。

### 数据冲突

如果两个设备同时修改同一数据，系统会自动选择较新的版本。建议：
- 避免同时在多个设备上编辑
- 完成操作后再同步

## 架构

### 服务端 (Go + MySQL)

```
sync-server/
├── main.go              # 主程序入口
├── go.mod               # Go 模块依赖
├── init.sql             # 数据库初始化脚本
├── config/              # 配置
├── models/              # 数据模型
├── handlers/            # HTTP 处理器
└── middleware/          # 中间件
```

### 客户端 (TypeScript)

```
src/main/sync/
├── types.ts             # 类型定义
├── api.ts               # API 客户端
└── index.ts             # 同步服务

src/main/ipc/handlers/
└── sync.ts              # IPC 处理器

src/renderer/components/preferences/
└── Sync.vue             # 同步设置 UI
```

## 未来改进

- [ ] 支持 HTTPS
- [ ] 添加端到端加密
- [ ] 支持冲突解决策略选择
- [ ] 添加同步历史记录
- [ ] 支持多账号切换
- [ ] 添加 Web 客户端

## 许可证

同步功能遵循 massCode 的 AGPL-3.0 许可证。
