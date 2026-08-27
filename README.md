# AI Native 团队协同开发系统

面向真人团队与 Codex 辅助工作的项目协作原型。包含项目、需求、任务、Bug、版本、文件引用、权限和个人 API Key。

## 本地启动

1. 复制 `.env.example` 为 `.env`，填写 `AUTH_SECRET` 和阿里云短信配置。
2. 启动数据库：`docker compose up -d postgres`
3. 初始化数据：`npm run db:generate && npm run db:migrate -- --name init && npm run db:seed`
4. 启动网站：`npm run dev`

演示账户为 `13800000001`，种子密码为 `Chorify2026!`。请勿在生产环境使用演示凭据。

## Codex API

个人 API Key 使用 `Authorization: Bearer chp_...`：

- `GET /api/v1/tokens`：网页登录用户查询自己的令牌和可授权项目
- `POST /api/v1/tokens`：创建令牌，完整密钥只返回一次
- `PATCH /api/v1/tokens/:tokenId`：修改名称、项目范围、权限和有效期
- `DELETE /api/v1/tokens/:tokenId`：不可恢复地撤销令牌
- `GET /api/v1/me/work-context`：需要 `task:read`
- `GET /api/v1/tasks/:taskId/context`：需要 `task:read`
- `POST /api/v1/tasks/:taskId/reports`：需要 `task:report`

令牌支持多项目和细粒度权限。业务接口同时校验用户项目成员身份、令牌项目范围和所需权限。已预留 `project:*`、`requirement:*`、`task:*`、`bug:*`、`version:*`、`file:*` 和 `document:*` 权限命名空间。

## 预发布部署

预发布环境使用 `deploy/docker-compose.staging.yml`，应用仅监听服务器回环地址 `127.0.0.1:3308`，由 Nginx 对外提供访问。健康检查地址为 `/api/health`。
