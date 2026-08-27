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

- `GET /api/v1/me/work-context`
- `GET /api/v1/tasks/:taskId/context`
- `POST /api/v1/tasks/:taskId/reports`

工作汇报接口只允许任务负责人提交，提交后进入待验收并生成审计日志。

## 预发布部署

预发布环境使用 `deploy/docker-compose.staging.yml`，应用仅监听服务器回环地址 `127.0.0.1:3308`，由 Nginx 对外提供访问。健康检查地址为 `/api/health`。
