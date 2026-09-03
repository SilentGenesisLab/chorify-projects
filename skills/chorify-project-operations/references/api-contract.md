# Chorify 任务 API

请求使用 `Authorization: Bearer <API_KEY>`；需要幂等的写操作同时提供 8–128 字符的 `Idempotency-Key`。

- `GET /api/v1/me/work-context`：读取工作上下文，`task:read`。
- `GET /api/v1/tasks/{taskId}/context`：读取任务上下文，`task:read`。
- `PATCH /api/v1/tasks/{taskId}`：快捷修改优先级或合法状态，`task:update`。
- `POST /api/v1/tasks/{taskId}/reports`：负责人提交工作汇报并申请验收，`task:report`。
- `POST /api/v1/tasks/{taskId}/acceptances`：指定验收人闭环或退回，`task:accept`。

```json
{ "status": "PENDING_ACCEPTANCE" }
```

```json
{
  "decision": "PASS",
  "conclusion": "验收标准已全部满足",
  "verificationEvidence": "接口测试、页面回归和交付文件均已核对"
}
```

`401` 表示 Key 无效、过期或撤销；`403` 表示身份有效但缺少动作权限或真人业务权限；`409` 表示当前任务状态不允许该操作。

