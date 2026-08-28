export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const guide = `# Chorify CLI 使用说明

Chorify CLI 让真人用户授权的 AI/Codex 通过 API Key 查询和操作项目数据。所有写操作仍归属于 API Key 所属的真人用户，并进入操作日志。

## 一键安装

\`\`\`bash
curl -fsSL ${origin}/cli | bash
export PATH="$HOME/.local/bin:$PATH"
\`\`\`

## 登录

先在 Chorify 的“系统管理 → API Key”创建 Key，选择项目和权限。完整 Key 只展示一次。

\`\`\`bash
chorify auth login --api-key 'chp_xxx'
chorify doctor
chorify context
\`\`\`

也可不落盘，通过环境变量运行：

\`\`\`bash
export CHORIFY_API_KEY='chp_xxx'
export CHORIFY_BASE_URL='${origin}'
chorify context
\`\`\`

## 常用操作

\`\`\`bash
chorify list projects
chorify list tasks <project-id>
chorify get tasks <project-id> <task-id>
chorify create requirements <project-id> '{"title":"登录与注册","priority":"HIGH"}'
chorify create tasks <project-id> '{"title":"实现登录页","priority":"HIGH"}'
chorify update tasks <project-id> <task-id> '{"status":"IN_PROGRESS"}'
chorify task-context <task-id>
chorify task-report <task-id> '{"summary":"已完成登录页","details":"构建与测试通过"}'
chorify task-accept <task-id> '{"action":"APPROVE","comment":"验收通过"}'
\`\`\`

支持资源：projects、requirements、tasks、bugs、versions、releases、members、milestones、files、folders、teams、notifications、audit-logs。

未封装的接口可使用：

\`\`\`bash
chorify raw GET /api/v1/me/work-context
chorify raw PATCH /api/v1/projects/<project-id> '{"description":"新的项目简介"}'
\`\`\`

## 给 AI 的最短指令

> 安装 Chorify CLI：\`curl -fsSL ${origin}/cli | bash\`。然后使用我提供的 API Key 登录，先运行 \`chorify context\` 获取本人任务、对接人和项目范围。任何写操作前先确认目标项目与资源，写操作后读取结果并汇报；不得扩大权限、管理 API Key、删除项目或执行正式发布。

## 安全

- 不要把 API Key 写进仓库、任务描述或聊天公开内容。
- Key 仅保存在 \`~/.chorify/config\`（权限 600），可用 \`chorify auth logout\` 删除本机凭据。
- 最终权限为真人用户权限、项目成员权限、Key 项目范围和 Key 权限范围的交集。
- 建议为不同 AI/设备创建不同 Key，并设置有效期；泄露时立即在网页撤销。
`;
  return new Response(guide, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
