export const API_TOKEN_PERMISSIONS = [
  "project:read", "project:update", "requirement:read", "requirement:create", "requirement:update",
  "task:read", "task:create", "task:update", "task:report", "task:accept",
  "bug:read", "bug:create", "bug:update", "version:read", "version:update",
  "file:read", "file:create", "file:update", "document:read", "document:write",
] as const;
export type ApiTokenPermission = typeof API_TOKEN_PERMISSIONS[number];
export const API_PERMISSION_GROUPS = [
  { key: "project", label: "项目", permissions: ["project:read", "project:update"] },
  { key: "requirement", label: "需求", permissions: ["requirement:read", "requirement:create", "requirement:update"] },
  { key: "task", label: "任务", permissions: ["task:read", "task:create", "task:update", "task:report", "task:accept"] },
  { key: "bug", label: "Bug", permissions: ["bug:read", "bug:create", "bug:update"] },
  { key: "version", label: "版本", permissions: ["version:read", "version:update"] },
  { key: "file", label: "文件", permissions: ["file:read", "file:create", "file:update"] },
  { key: "document", label: "文档", permissions: ["document:read", "document:write"] },
] as const;
export const API_PERMISSION_LABELS: Record<ApiTokenPermission, string> = {
  "project:read": "查看项目", "project:update": "修改项目", "requirement:read": "查看需求", "requirement:create": "创建需求", "requirement:update": "修改需求",
  "task:read": "查看任务", "task:create": "创建任务", "task:update": "修改任务", "task:report": "提交汇报", "task:accept": "任务验收",
  "bug:read": "查看 Bug", "bug:create": "创建 Bug", "bug:update": "修改 Bug", "version:read": "查看版本", "version:update": "修改版本",
  "file:read": "查看文件", "file:create": "创建文件", "file:update": "修改文件", "document:read": "查看文档", "document:write": "写入文档",
};
export const DEFAULT_API_PERMISSIONS: ApiTokenPermission[] = ["project:read", "requirement:read", "task:read", "task:report", "bug:read", "version:read", "file:read", "document:read"];
